#!/usr/bin/env bash
# Vercel "Ignored Build Step": exit 0 skips the build, exit 1 builds.
# Only master deploys. A master push that touches nothing the site ships
# (notes, docs, tests, archives) skips the 7-minute production build.
# Anything unexpected (no previous deploy, a commit missing from the shallow
# clone, a git error) falls through to a normal build.

if [ "$VERCEL_GIT_COMMIT_REF" != "master" ]; then
  exit 0
fi

if [ -z "$VERCEL_GIT_PREVIOUS_SHA" ]; then
  exit 1
fi

if git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . \
  ':(exclude)wiki' \
  ':(exclude)docs' \
  ':(exclude)tests' \
  ':(exclude)archive' \
  ':(exclude)artifacts' \
  ':(exclude)market_intelligence' \
  ':(exclude)output' \
  ':(exclude).github' \
  ':(exclude).claude' \
  ':(exclude).cursor' \
  ':(exclude,glob)*.md'; then
  echo "Only non-site files changed since $VERCEL_GIT_PREVIOUS_SHA; skipping the build."
  exit 0
fi

exit 1
