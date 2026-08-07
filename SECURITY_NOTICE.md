# ⚠️ Read this first

Your uploaded project contained **live, working secrets** committed directly into files:

1. **`.env`** contained a real Telegram `BOT_TOKEN` and `CHANNEL_ID`.
2. **`db.json`** (in the project root) contained real usernames and **plain-text passwords** for at least two accounts.

Both are removed from this rebuild — `.env` is not included at all (only a
placeholder `.env.example`), and the database now starts empty. But the
originals were already inside the ZIP you uploaded, which means:

## Do this now

1. **Revoke the bot token immediately.** Open a chat with
   [@BotFather](https://t.me/BotFather) on Telegram, send `/revoke`, pick
   the bot, and generate a new token. The old token in your upload must be
   treated as compromised — anyone who sees it can send messages as your
   bot and read/write to whatever chat it's in.
2. **Assume the leaked account passwords are compromised.** If either
   `sangam kumar` / `@@@SANGAM@kumar@zero8787` or `sangam` / `sangam` (or
   similar) are reused anywhere else (email, other sites), change those
   passwords too. Plain-text password storage meant anyone with the file
   had the real password, not just a hash.
3. Put your **new** token and a fresh `SESSION_SECRET` only in your local
   `.env` file, which is git-ignored and was not included in this delivered
   project.
4. If this project was ever pushed to a public (or even private-but-shared)
   Git repository with the old `.env`/`db.json` committed, rotating the
   token is not enough — you should also scrub it from Git history
   (`git filter-repo` or BFG Repo-Cleaner), since anyone with repo access
   or a cached fork still has the old values.

This is unrelated to code quality — it's just the most urgent thing to act
on, so it's called out before anything else in this report set.
