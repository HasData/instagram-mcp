# Instagram MCP Server

A hosted Model Context Protocol (MCP) server that gives Claude, Cursor, Windsurf and any other MCP client two read-only Instagram tools. Look up a public profile by handle, and walk its public post feed, as structured JSON.

It reads public data about accounts. It does not act as an account. There is nothing to connect and no account of yours involved anywhere in the flow.

```
https://mcp.hasdata.com/api/mcp?apis=instagram
```

[![tool contract](https://github.com/HasData/instagram-mcp/actions/workflows/contract.yml/badge.svg)](https://github.com/HasData/instagram-mcp/actions/workflows/contract.yml)
[![MCP](https://img.shields.io/badge/MCP-remote%20%7C%20streamable%20HTTP-6366f1?style=flat-square)](https://modelcontextprotocol.io)
[![Tools](https://img.shields.io/badge/tools-2-10b981?style=flat-square)](#tools)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

## Contents

- [What you need](#what-you-need)
- [Quick start](#quick-start)
- [Example prompts](#example-prompts)
- [Tools](#tools)
- [Errors and failure paths](#errors-and-failure-paths)
- [Pricing, free tier and limits](#pricing-free-tier-and-limits)
- [Tool selection](#tool-selection)
- [How it compares](#how-it-compares)
- [FAQ](#faq)
- [HasData links](#hasdata-links)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## What you need

An MCP client that speaks streamable HTTP with custom headers. A HasData API key from the [dashboard](https://app.hasdata.com/sign-up?utm_source=github&utm_medium=syndication&utm_campaign=instagram-mcp), free to create with no card, and the trial covers 100 calls. Nothing else. This is a remote server. There is no package to install, no container to run and no local process that has to stay up.

## Quick start

| | |
| :--- | :--- |
| URL | `https://mcp.hasdata.com/api/mcp?apis=instagram` |
| Transport | HTTP, streamable |
| Auth header | `x-api-key: HASDATA_API_KEY` |

The server URL is the same for every client. We run it hands-on in Claude Code and Claude Desktop. The other blocks follow each client's own documented format for a remote server.

Clients with OAuth support can add the same URL as a connector and sign in without putting a key in a config file.

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add --transport http instagram "https://mcp.hasdata.com/api/mcp?apis=instagram" \
  --header "x-api-key: HASDATA_API_KEY"
```

</details>

<details>
<summary><b>Claude Desktop</b></summary>

Claude Desktop loads only local (stdio) servers from its config file, so a remote server is reached through the `mcp-remote` bridge. Node has to be on the machine.

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "instagram": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp.hasdata.com/api/mcp?apis=instagram",
        "--header",
        "x-api-key:HASDATA_API_KEY"
      ]
    }
  }
}
```

The `x-api-key:` value carries no space after the colon. Claude Desktop passes the argument without a shell, and a space splits the header. A client with OAuth support can instead add the URL as a custom connector and skip the bridge.

</details>

<details>
<summary><b>Cursor</b></summary>

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "instagram": {
      "url": "https://mcp.hasdata.com/api/mcp?apis=instagram",
      "headers": { "x-api-key": "HASDATA_API_KEY" }
    }
  }
}
```

</details>

<details>
<summary><b>Windsurf</b></summary>

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "instagram": {
      "serverUrl": "https://mcp.hasdata.com/api/mcp?apis=instagram",
      "headers": { "x-api-key": "HASDATA_API_KEY" }
    }
  }
}
```

</details>

<details>
<summary><b>Cline</b></summary>

```json
{
  "mcpServers": {
    "instagram": {
      "url": "https://mcp.hasdata.com/api/mcp?apis=instagram",
      "type": "streamableHttp",
      "headers": { "x-api-key": "HASDATA_API_KEY" },
      "disabled": false
    }
  }
}
```

</details>

<details>
<summary><b>VS Code</b></summary>

`.vscode/mcp.json`:

```json
{
  "servers": {
    "instagram": {
      "type": "http",
      "url": "https://mcp.hasdata.com/api/mcp?apis=instagram",
      "headers": { "x-api-key": "HASDATA_API_KEY" }
    }
  }
}
```

</details>

<details>
<summary><b>Gemini CLI</b></summary>

`~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "instagram": {
      "httpUrl": "https://mcp.hasdata.com/api/mcp?apis=instagram",
      "headers": { "x-api-key": "HASDATA_API_KEY" }
    }
  }
}
```

</details>

## Example prompts

Each of these is one tool call unless the count says otherwise.

> Pull the profile for `@nasa` and tell me the follower count, the category and every link in the bio.

*One call, 10 credits. For a public account the profile response already carries the twelve most recent posts, so a follow-up about recent activity needs no second call.*

> Compare `@nasa`, `@natgeo` and `@bbcearth` on followers, posts published and whether each is a business account.

*Three calls, 30 credits. One per handle.*

> Walk the last fifty posts from `@nasa` and list every hashtag with how often it appears.

*Five calls, 50 credits. Twelve posts arrive per call, and fifty takes five pages.*

> For the last twelve posts on `@natgeo`, give me likes, comments and the accounts mentioned in each caption.

*One call, 10 credits. Engagement counts and mentions come parsed in the post objects.*

Two things make these work. Hashtags and mentions arrive as arrays parsed out of the caption, and an agent counts them instead of running a regex over prose. And a profile lookup returns the recent feed in the same response. That is why so many research questions land in a single call.

## Tools

Two tools, both read-only, both keyed on a public account handle. Samples below are trimmed from real calls, and the numbers in them move as accounts post. Read them as shapes. Each tool name links to its endpoint reference.

The samples are the payload, not the whole response. A `tools/call` result carries one text block, and that text is itself JSON holding `url`, `status`, `text` and `json`, with the scraped data under `json`. From a raw JSON-RPC response the path is `result.content[0].text`, parsed, then `.json`. A chat client unwraps that for you and code talking to the endpoint directly does not.

### Get an Instagram profile

[`hasdata_instagram_profile_getInstagramProfile`](https://docs.hasdata.com/apis/instagram/profile?utm_source=github&utm_medium=syndication&utm_campaign=instagram-mcp)

One public profile by handle.

| Parameter | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `handle` | string | yes | Username without the `@`, as it appears in the profile URL |

Returns `id`, `username`, `fullName`, `biography`, `businessCategory`, `verified`, `isBusinessAccount` and `isProfessionalAccount`, the counters `followersCount`, `followsCount`, `postsCount`, `highlightsCount` and `igtvVideoCount`, both `profilePicUrl` and `profilePicUrlHD`, and the arrays `latestPosts`, `latestIgtvVideos` and `relatedProfiles`.

The core identity fields and the follower and following counts come back for every public account. The fields beyond that depend on what the account itself exposes, so read the optional ones with a default.

> Links live in two fields that are not the same thing. `bioLinks` is the array of every link in the bio. `externalUrls` is a single string despite the plural name, and it holds the primary link, sometimes with a trailing slash the array version lacks. Read `bioLinks` when you want them all.

> `latestPosts` and `latestIgtvVideos` do not carry identical fields. Video entries add `taggedUsers`, and the post objects here omit the `productType` that the posts tool includes. Code that walks both arrays through one parser has to treat the extra keys as optional.

```json
{
  "id": "528817151",
  "username": "nasa",
  "fullName": "NASA",
  "biography": "Making the seemingly impossible, possible. ✨",
  "businessCategory": "Government Agencies",
  "bioLinks": [
    "https://www.nasa.gov",
    "https://science.nasa.gov/mission/roman-space-telescope/",
    "http://intern.nasa.gov"
  ],
  "externalUrls": "https://www.nasa.gov/",
  "followersCount": 104397669,
  "followsCount": 92,
  "postsCount": 4887,
  "verified": true,
  "isBusinessAccount": true,
  "latestPosts": [ "…twelve most recent posts, same shape as the posts tool…" ],
  "relatedProfiles": [
    { "id": "…", "username": "…", "fullName": "…", "profilePicUrl": "…" }
  ]
}
```

`relatedProfiles` is Instagram's own suggestion list for the account and runs to a few dozen entries. It is a cheap way to widen a competitor set without guessing handles.

### Get Instagram posts

[`hasdata_instagram_posts_getInstagramPosts`](https://docs.hasdata.com/apis/instagram/posts?utm_source=github&utm_medium=syndication&utm_campaign=instagram-mcp)

The public post feed for one handle, page by page.

| Parameter | Type | Required | Notes |
| :--- | :--- | :--- | :--- |
| `handle` | string | yes | Username without the `@` |
| `limit` | number | | Approximate ceiling on posts in one response. Twelve is the real maximum, and larger values do not fetch more |
| `nextPageToken` | string | | The `pagination.nextPageToken` from the previous response |

> `limit` is a rough cap rather than an exact count. Twelve posts is one Instagram page and the hard ceiling for a single call, and `limit: 50` returns twelve. Below the ceiling the count lands near the number you asked for without always matching it, and how near depends on the account. Measured on `@nasa`, a limit of 2 returned 4 posts, 6 returned 6, 11 returned 10 and 13 returned 12. Treat it as "no more than roughly this many" and read the array length rather than assuming it.

> The response repeats the account's identity fields alongside the posts. `username`, `id`, `fullName`, `verified` and both avatar URLs arrive on every page. Handy for labelling rows, and worth knowing before you make a separate profile call to get them.

Each post carries `id`, `shortcode`, `caption`, `type`, `productType`, `hashtags`, `mentions`, `likesCount`, `commentsCount`, `timestamp`, `url`, `displayUrl`, `images`, `dimensionsWidth`, `dimensionsHeight`, `ownerId` and `ownerUsername`.

```json
{
  "username": "nasa",
  "id": "528817151",
  "fullName": "NASA",
  "verified": true,
  "latestPosts": [
    {
      "id": "3967213292204992434",
      "shortcode": "DcOX3hWFiey",
      "caption": "With your powers combined…\n\nThis colorful picture of the cosmos is the product of teamwork between our @NASAHubble, @NASAWebb, and @NASAChandraXray telescopes. […] \n\n#NASA #Universe #Nebula",
      "type": "Image",
      "hashtags": ["#NASA", "#Universe", "#Nebula"],
      "mentions": ["@NASAHubble", "@NASAWebb", "@NASAChandraXray"],
      "likesCount": 78412,
      "commentsCount": 402,
      "timestamp": "2026-08-18T16:02:11.000Z",
      "url": "https://www.instagram.com/p/DcOX3hWFiey/"
    }
  ],
  "pagination": {
    "morePostsAvailable": true,
    "nextPageToken": "3968050822236429248_528817151",
    "hasdataLink": "https://api.hasdata.com/scrape/instagram/posts?handle=nasa&nextPageToken=3968050822236429248_528817151"
  }
}
```

Hashtags and mentions keep their `#` and `@` prefixes, which matters if you are joining them against a list you built yourself. `morePostsAvailable` is the flag to branch on when paging, and `hasdataLink` is the same next page expressed as a REST URL, useful when you want to reproduce an agent's call by hand.

## Errors and failure paths

Your client almost never sees an HTTP error code from a tool call. The MCP layer answers 200 and puts the failure inside the result, with `isError` set to `true` and the reason as text. The agent reads a message where you might expect a status line.

**A wrong key surfaces as tool output, not as a failed connection.** Listing tools accepts any non-empty key, and the client completes its handshake and shows green. The first tool call then comes back with `isError: true` and the text `HasData API error: 401 Unauthorized`. Watch for that string, because nothing earlier in the flow reports the problem.

**A missing key is the one real HTTP error.** Authorization runs before any tool, and the connection itself fails with 401.

**An argument that breaks the schema is rejected before it becomes a request.** The server answers with `isError: true` and the text `MCP error -32602: Input validation error`, naming the field. Nothing is fetched and nothing is charged.

**A handle that does not resolve is a clean error, not empty data.** It returns `isError: true` with `HasData API error: 400 Bad Request` and `requestMetadata.status` set to `error`. This is the good case, because the failure is unambiguous. Test the flag rather than the array length.

**An account whose data is not public returns no post feed.** The tools cover public accounts, and there is nothing to read on one that is not. Treat a missing `latestPosts` as out of scope and not as an empty feed.

Results that carry data also carry a `requestMetadata.id` worth quoting in support, plus `html` and `json` links to the stored artifact of that exact call.

## Pricing, free tier and limits

Every Instagram tool costs **10 credits per successful call**. Response size does not change the price. A profile with twelve posts attached costs the same as one with none.

The free trial is **1,000 credits over 30 days with no card**, or 100 Instagram calls. After that an active account keeps getting 100 credits topped up each day whenever its balance drops below 100, so a low-volume agent runs on the free tier indefinitely.

Paid plans start at **$49 a month** for 200,000 credits, or 20,000 calls. The unit price falls with volume, from **$2.45 per 1,000 calls** on the entry plan to **$0.99** on Business, **$0.83** on Growth and **$0.75** on the largest [high-volume plans](https://hasdata.com/prices?utm_source=github&utm_medium=syndication&utm_campaign=instagram-mcp).

Your plan also sets concurrency. The free trial allows 1 request at a time, Startup 15, Business 30, Growth 50, and the high-volume plans run from 200 to 1,500. Handle the overflow case defensively in anything unattended, because an agent that fans out across handles will reach the ceiling before you do.

Paging costs a call each time. A prompt that walks a hundred posts across two accounts is eighteen calls and 180 credits. The trial goes further on profile comparisons than on deep feed crawls.

## Tool selection

`?apis=instagram` exposes exactly these two tools. The parameter takes a list, and `?apis=instagram,tiktok,youtube` gives your agent three social platforms at once. Drop the parameter and you get everything HasData exposes, which is currently 57 tools.

A narrow list is usually the better default. A model choosing between two tools picks correctly more often than one choosing between fifty-seven, and the tool descriptions themselves cost context on every turn.

Cross-platform comparison is the usual reason to widen the list. Ask the same question of an Instagram handle and a TikTok handle and it is one prompt once both are exposed.

## How it compares

Almost every Instagram MCP server does something different from this one, and that makes the choice unusually clear.

The popular ones operate an account. Some wrap the Instagram Graph API to publish posts, read comments and manage the accounts you administer. Others handle direct messages. The engagement-analysis servers ask for `INSTAGRAM_USERNAME` and `INSTAGRAM_PASSWORD` in an env block, per their own setup instructions, because they sign in and browse as you. All of those are the right tool when the job is to run an account you control.

This server never signs in as anyone, which is a different job. Every question it answers is about a handle you do not own, and the call is identical whichever handle that is.

| | Account-operating server | This server |
| :--- | :--- | :--- |
| What it acts as | Your account, via a token or a session | Nothing, it reads public data |
| What you configure | Credentials or a Graph API app, per account | One API key, once |
| Which handles it covers | The accounts you administer | Any public handle |
| Publishing and messaging | Yes, that is the point | Not offered |
| Output | Scoped to the account you run | JSON for any public handle, hashtags and mentions parsed |
| What you run | A Python or Node process locally | A URL and a header |
| Cost | Free | 10 credits a call |

Two rows decide it. If you need to post, comment or reply, this server cannot help you at all. If you need the same fields across a hundred handles you have no relationship with, a server built around your own credentials cannot help you either.

The deciding axis is scope, not polish. A server built around your own login can only reach the accounts you administer, however good its output is. This one answers the same question for any public handle, and the fields come back as parsed arrays that cost nothing to aggregate.

**What this server does not do.** No comments, no stories, no reels beyond what the feed reports, no direct messages, no hashtag or location search, and nothing that writes. It reads two things well.

## FAQ

### What is an Instagram MCP server?

A server that exposes Instagram data as tools an AI client can call. The client sends a tool call over the Model Context Protocol, the server fetches the data and returns structured JSON, and the model works with the result and never sees a page of HTML. This one exposes two read-only tools and runs remotely. The client connects to a URL and starts no local process.

### Is there an official Instagram MCP server?

Meta publishes no general-purpose one. There is an official MCP for Meta advertising, and it covers ad accounts and campaigns, not profile and post data. Everything else in this space is built by somebody else.

### What data is in scope?

Public profile fields and the public post feed, for public accounts, by handle. A private account still returns its header, the follower and following counts and a `private: true` flag, but no biography and no posts, since there is no public feed to read. You are responsible for how you use the results, including compliance with Instagram's terms and with the law that applies to you.

### Do I need to host or run anything?

No. This is a remote MCP server on streamable HTTP. Nothing to install, no Python environment, no process to restart.

### Is the data live or cached?

Live. Each call fetches at request time and carries its own `requestMetadata.id`. Two identical calls are two separate fetches and not a replay of a stored copy. Counters like followers and likes track the account and move as it moves.

### How many posts can I get?

Twelve per call, one Instagram page, and further pages come from `pagination.nextPageToken`. For a public account the profile lookup includes the same twelve at no extra cost, so short feed questions often need no posts call at all.

### What happens when Instagram changes its markup?

Nothing on your side. We track the changes and keep the response schema stable, and field names and types stay put. A field with no value is absent from the item instead of present and null, and that is why optional fields should be read with a default.

### Can I use one server for several platforms?

Yes. The `apis` parameter takes a list, and `?apis=instagram,tiktok,youtube` gives your agent three platforms at once.

### Which clients work?

Any MCP client that supports streamable HTTP with custom headers. The configs above are tested. Clients with OAuth support can add the URL as a connector instead.

## HasData links

| | |
| :--- | :--- |
| Product pages and request builder | [Instagram Profile API](https://hasdata.com/apis/instagram-profile-api?utm_source=github&utm_medium=syndication&utm_campaign=instagram-mcp) and [Instagram Posts API](https://hasdata.com/apis/instagram-posts-api?utm_source=github&utm_medium=syndication&utm_campaign=instagram-mcp) |
| Server documentation | [MCP server docs](https://docs.hasdata.com/mcp-server?utm_source=github&utm_medium=syndication&utm_campaign=instagram-mcp) |
| All 57 tools in one server | [HasData/hasdata-mcp](https://github.com/HasData/hasdata-mcp) |
| Client walkthroughs | [MCP clients and integrations](https://hasdata.com/integrations/mcp?utm_source=github&utm_medium=syndication&utm_campaign=instagram-mcp) |
| The other platforms we parse | [53 more scraper APIs](https://hasdata.com/apis/?utm_source=github&utm_medium=syndication&utm_campaign=instagram-mcp) |
| Plans and credit costs | [Plans and credit costs](https://hasdata.com/prices?utm_source=github&utm_medium=syndication&utm_campaign=instagram-mcp) |
| Keys and usage | [HasData dashboard](https://app.hasdata.com?utm_source=github&utm_medium=syndication&utm_campaign=instagram-mcp) |

## Development

This repository is configuration and documentation for a remote server. There is no build step and nothing to containerize.

It does carry a contract test. The README promises two tools with specific parameters, and the upstream tool list can change without a commit here, and that would leave this file quietly lying to you. The test asserts the promise and runs weekly in CI as well as on every push.

```bash
HASDATA_API_KEY=your_key_here npm test
```

On PowerShell:

```powershell
$env:HASDATA_API_KEY = "your_key_here"; npm test
```

The last check makes a real call and costs 10 credits, which is the price of a canary that can fail for the right reason. Listing tools succeeds with any non-empty key, and a test that only lists tools stays green with a revoked one.

## Contributing

Corrections to the tool tables and the response samples are the most useful contribution, because those are the parts that drift. Include the call you made and the response you got. Pull requests from forks run the suite without a key, and the live checks skip instead of going red.

## License

MIT. See [LICENSE](LICENSE).
