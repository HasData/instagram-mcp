// Tool contract test.
//
// The README promises two tools and a specific parameter set for each. Either can change upstream
// without a commit here, and the README would start lying silently. These checks catch that before
// a user does.
//
// The last two tests share one real call. Listing tools accepts any non-empty key, so a contract
// check that only lists tools stays green with a revoked or mistyped key. That single call costs
// 10 credits, which is the price of a canary that can fail for the right reason.
//
// Run: HASDATA_API_KEY=your_key_here npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ENDPOINT = 'https://mcp.hasdata.com/mcp?apis=instagram';
const KEY = process.env.HASDATA_API_KEY;
const TIMEOUT_MS = 60_000;

const PROFILE = 'hasdata_instagram_profile_getInstagramProfile';
const POSTS = 'hasdata_instagram_posts_getInstagramPosts';
const COMMENTS = 'hasdata_instagram_comments_getInstagramComments';

// Parameters the README documents, and whether it documents them as required.
const PARAMS = {
    [PROFILE]: { handle: true },
    [POSTS]: { handle: true, limit: false, nextPageToken: false },
    [COMMENTS]: { url: true, nextPageToken: false, includeMusic: false },
};

// A public institutional account, chosen because it posts often enough that the feed is never
// empty and stable enough that the handle will not disappear.
const HANDLE = 'nasa';

// A streamable HTTP body arrives either as plain JSON or as server-sent events. One SSE event
// can span several data: lines, several events can share one response, and a server is free to
// send progress notifications before the answer. So collect every event and pick the message
// carrying our request id.
function parseRpc(raw, id) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) return JSON.parse(trimmed);

    const messages = [];
    for (const event of trimmed.split(/\r?\n\r?\n+/)) {
        const data = event
            .split(/\r?\n/)
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).replace(/^ /, ''))
            .join('\n');
        if (!data || data === '[DONE]') continue;
        try {
            messages.push(JSON.parse(data));
        } catch {
            // A keep-alive or a partial event is not our response.
        }
    }
    assert.ok(messages.length, `no JSON-RPC message in the response: ${raw.slice(0, 300)}`);
    const match = messages.find((m) => m.id === id);
    assert.ok(match, `no message with id ${id} in the response: ${raw.slice(0, 300)}`);
    return match;
}

let nextId = 1;

async function rpc(method, params = {}) {
    // The CI key sits on the free plan, where concurrency is 1. When several of
    // these repos are pushed at once their contract runs collide, and HasData
    // answers 429 with code concurrency_limit straight away rather than queueing.
    // That is a plan limit, not a broken contract, so the call is retried before
    // the test gives up. A 401 still fails on the first attempt.
    for (let attempt = 1; ; attempt++) {
        const id = nextId++;
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'x-api-key': KEY,
                'Content-Type': 'application/json',
                // The server answers over streamable HTTP, so accept both a plain body and a stream.
                Accept: 'application/json, text/event-stream',
            },
            body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        assert.equal(res.status, 200, `${method} returned ${res.status}`);
        const raw = await res.text();
        if (raw.includes('concurrency_limit') && attempt < 5) {
            await new Promise((r) => setTimeout(r, attempt * 4000));
            continue;
        }
        return { raw, body: parseRpc(raw, id) };
    }
}

// A tools/call result wraps the payload in a single text block holding url, status, text and json.
// The scraped data is under json. Anything the README says about field names is a claim about
// that object, so unwrap before asserting.
async function callTool(name, args) {
    const { raw, body } = await rpc('tools/call', { name, arguments: args });
    assert.ok(!raw.includes('401 Unauthorized'), 'HasData rejected the key');
    assert.ok(!raw.includes('"isError":true'), `${name} failed: ${raw.slice(0, 300)}`);
    const text = body.result?.content?.[0]?.text;
    assert.ok(text, `${name} returned no text block`);
    const envelope = JSON.parse(text);
    assert.ok(envelope.json, `${name} returned an envelope with no json payload`);
    return envelope.json;
}

let toolsPromise;
function listTools() {
    toolsPromise ??= rpc('tools/list').then(({ body }) => {
        assert.ok(body.result?.tools, 'the response carried no result.tools');
        return body.result.tools;
    });
    return toolsPromise;
}

const live = { skip: KEY ? false : 'HASDATA_API_KEY is not set, skipping the live checks' };

test('apis=instagram exposes exactly the three documented tools', live, async () => {
    const tools = await listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [COMMENTS, POSTS, PROFILE].sort(), `the tool list is now ${names.join(', ')}`);
});

test('every documented parameter still exists, and required stays required', live, async () => {
    const tools = await listTools();
    for (const [name, params] of Object.entries(PARAMS)) {
        const tool = tools.find((t) => t.name === name);
        assert.ok(tool, `${name} is missing upstream`);
        const props = tool.inputSchema?.properties ?? {};
        const required = tool.inputSchema?.required ?? [];
        for (const [param, isRequired] of Object.entries(params)) {
            assert.ok(props[param], `${name}.${param} is in the README but missing upstream`);
            assert.equal(
                required.includes(param),
                isRequired,
                `${name}.${param} required is now ${!isRequired}, the README says ${isRequired}`
            );
        }
    }
});

test('both tools carry a description', live, async () => {
    const tools = await listTools();
    for (const tool of tools) {
        assert.ok(
            (tool.description || '').trim().length > 20,
            `${tool.name} has an empty or near-empty description`
        );
    }
});

// One live call covers both tools. The profile response already carries the recent feed, so a
// single profile lookup lets us check the profile fields and the post-object shape at once, which
// keeps the canary at 10 credits a run. The posts tool's own parameters are asserted from
// tools/list above, at no credit cost. What a live posts call would add on top, the twelve-per-page
// ceiling and the pagination keys, is documented from measurement in the README rather than
// re-checked here, to keep the run cheap.
let profilePromise;
function fetchProfile() {
    profilePromise ??= callTool(PROFILE, { handle: HANDLE });
    return profilePromise;
}

// Instagram does not hand out the same fields for every account, so the test splits them.
// Measured 2026-09-22 across twenty accounts: the first group came back for all twenty, the
// second for every public one. The single private account in the sample answered with
// `private: true` and none of the rest, which is why it is a documented branch and not a failure.
test('a profile response still carries the documented fields', live, async () => {
    const profile = await fetchProfile();
    assert.equal(profile.username, HANDLE, `asked for ${HANDLE}, got ${profile.username}`);

    const always = ['id', 'username', 'followersCount', 'followsCount', 'profilePicUrl', 'fbid'];
    const missingAlways = always.filter((field) => !(field in profile));
    assert.deepEqual(missingAlways, [], `every account carries these, and this one did not: ${missingAlways.join(', ')}`);

    if (profile.private) return;

    const publicOnly = ['fullName', 'biography', 'verified', 'bioLinks', 'latestPosts'];
    const missingPublic = publicOnly.filter((field) => !(field in profile));
    assert.deepEqual(missingPublic, [], `a public profile no longer carries: ${missingPublic.join(', ')}`);
    assert.ok(Array.isArray(profile.bioLinks), 'bioLinks is documented as an array');
    // The README tells the reader a profile lookup already includes the recent feed, which is why
    // several example prompts are one call rather than two.
    assert.ok(profile.latestPosts?.length, 'a profile lookup no longer includes the recent feed');
});

// Post objects, checked against the feed the profile call already returned, so this test adds
// no second live call. Engagement counters are deliberately absent from the list: across the
// 177 posts sampled on 2026-09-22 not one carried likesCount, commentsCount or a timestamp.
test('post objects still carry the documented fields', live, async () => {
    const profile = await fetchProfile();
    const [first] = profile.latestPosts ?? [];
    assert.ok(first, 'the feed came back empty for an account that posts regularly');

    const always = ['id', 'shortcode', 'caption', 'type', 'productType', 'url', 'ownerUsername', 'ownerId'];
    const missing = always.filter((field) => !(field in first));
    assert.deepEqual(missing, [], `post objects no longer carry: ${missing.join(', ')}`);

    // hashtags and mentions depend on the caption: in the sample mentions turned up in about half
    // the posts and hashtags in about a quarter, so they are asserted only where the caption has one.
    const withHashtag = (profile.latestPosts ?? []).find((post) => /#\w/.test(post.caption ?? ''));
    if (withHashtag) {
        assert.ok(Array.isArray(withHashtag.hashtags), 'a caption with a # no longer yields a hashtags array');
    }
    const withMention = (profile.latestPosts ?? []).find((post) => /@\w/.test(post.caption ?? ''));
    if (withMention) {
        assert.ok(Array.isArray(withMention.mentions), 'a caption with an @ no longer yields a mentions array');
    }
});

// The prompts and resources section of the README is generated from the live server, and the
// server changes it without a commit here: Indeed gained two parameter resources overnight on
// 2026-10-08 and the table fell behind the same day. These checks need no API key, because
// prompts/list and resources/list are served without one, so they run on a fork too.
// README prompts and resources section
const README_MD = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');

async function anonymousRpc(method) {
    const id = nextId++;
    const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params: {} }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    assert.equal(res.status, 200, `${method} returned ${res.status}`);
    return parseRpc(await res.text(), id).result;
}

// The section writes "ships one prompt" for a single entry and "ships 7 prompts" otherwise.
const statedCount = (verb) => {
    const m = README_MD.match(new RegExp(verb + String.raw`\s+(one|\d+)\s`));
    if (!m) return null;
    return m[1] === 'one' ? 1 : Number(m[1]);
};

test('the README states how many prompts the server serves', async () => {
    const { prompts } = await anonymousRpc('prompts/list');
    const stated = statedCount('ships');
    if (!prompts.length) {
        assert.equal(stated, null, 'the README claims prompts the server does not serve');
        return;
    }
    assert.ok(stated !== null, 'the server serves prompts and the README does not say how many');
    assert.equal(stated, prompts.length, `the README says ${stated} prompts, the server serves ${prompts.length}`);
});

test('the README states how many resources the server serves', async () => {
    const { resources } = await anonymousRpc('resources/list');
    const stated = statedCount('exposes');
    if (!resources.length) {
        assert.equal(stated, null, 'the README claims resources the server does not serve');
        return;
    }
    assert.ok(stated !== null, 'the server serves resources and the README does not say how many');
    assert.equal(stated, resources.length, `the README says ${stated} resources, the server serves ${resources.length}`);
});

test('every parameter with a fixed list is named in the README', async () => {
    const { resources } = await anonymousRpc('resources/list');
    const missing = resources
        .map((r) => (r.uri || '').split('/').pop())
        .filter((p) => p && !README_MD.includes(`\`${p}\``));
    assert.deepEqual(missing, [], `parameters the README does not name: ${missing.join(', ')}`);
});
