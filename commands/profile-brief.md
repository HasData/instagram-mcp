---
description: A brief on a public Instagram account and what it has been posting
---

Brief me on an Instagram account.

Ask me for the handle if I have not given it, without the @.

Then:

1. Call `hasdata_instagram_profile_getInstagramProfile` with that handle.
2. Branch on what came back. `isError` means read the error text and tell me which problem it is, a handle that does not resolve, a key that was rejected, or an argument the schema refused. `private: true` means the account is private, so say that and stop. A success with no `latestPosts` means there is no public feed to read.
3. Report `username`, `fullName`, `followersCount`, `followsCount`, whether it is `verified`, the biography, and the `url` from each entry in `bioLinks` rather than the entry itself, since those carry a redirect wrapper alongside the real address.
4. Read `latestPosts` before deciding whether to page. More than twelve posts means paging with `nextPageToken`, not a bigger `limit`, because twelve is the ceiling for one call and the first page repeats what the profile already returned.
5. Summarise the feed from the mix of `type` and `productType`, the recurring subjects in the captions, and the accounts that keep appearing in `mentions`.

Do not rank posts by engagement. This payload has no likes, no comments and no timestamps, so any ordering by popularity would be invented. If I ask for the best-performing post, tell me the data does not carry it.
