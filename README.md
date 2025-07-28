# Rails System Prompt

A system prompt that for CLI tools like Claude Code that embraces the Rails Way.

## Organization

There are several sources used to generate the system prompt:

* several articles written by Jorge Manrubia on the dev.37signals blog
* "How DHH organizes his Rails controllers" by Jerome Dalbert
* the "On Writing Software Well" set of videos by DHH
* The Railsconf 2014 keynote
* "Is TDD Dead?" videos with Martin Fowler, Kent Beck, and DHH
* "Worflows of Refactoring" by Martin Fowler

## Scripts

YouTube videos are converted to mp3 files using ytmp3.foo. The mp3 files are transcribed using the
`scripts/transcribe.mjs`,

There is a scripts/transcribe.mjs script that can be used to convert mp3 files