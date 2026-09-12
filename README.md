# Will it run on a Mac?

Work in progress. Paste a shell script, see every flag that breaks on macOS or BusyBox, with that platform's own man page and a real run as the proof.

Asked of ShellCheck since 2015 ([#479](https://github.com/koalaman/shellcheck/issues/479), [#973](https://github.com/koalaman/shellcheck/issues/973), [#1455](https://github.com/koalaman/shellcheck/issues/1455), [#2902](https://github.com/koalaman/shellcheck/issues/2902)); ShellCheck knows which shell you target, not which userland.

`collector/` is the first piece: a GitHub Actions matrix (Ubuntu, macOS, Alpine/BusyBox) that records what each platform's tools say about themselves and what happens when the classic GNU-only flags are executed there. Nothing in the flag database is written by hand.

MIT.
