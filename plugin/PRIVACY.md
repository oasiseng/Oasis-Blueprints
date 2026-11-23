# Privacy: Oasis Blueprints plugin

Last updated: November 23, 2026

This page covers the Oasis Blueprints plugin for Claude in both of its editions: the plan and review edition listed
in the Claude plugin directory, and the full edition in this repository. It is published by Oasis Engineering, LLC.
The privacy policy for our website, oasisengineering.com, is a separate document:
<https://oasisengineering.com/privacy-policy/>

## In short

The plugin collects nothing and sends nothing to Oasis Engineering. We do not receive your projects, your drawings,
your conversations or any information about how you use the plugin.

## What the plugin is

The plugin is a set of instructions and reference data for Claude, plus, in the full edition, scripts that run on your
own machine. It has no accounts, no server of ours, no analytics, no telemetry, no tracking and no advertising.

## What Claude reads while using it

To plan or draw a set, Claude reads what you choose to share in the conversation: project descriptions, dimensions,
site addresses, owner and company names, surveys, photos and existing plan sets. That conversation is handled by
Anthropic under Anthropic's own terms and privacy policy (<https://www.anthropic.com/legal/privacy>), not by us.

## What it writes

The plugin can write a project file, a drawing set (HTML and PDF), preview images and, in the full edition, a video.
These are saved where you or Claude choose to save them, in your own workspace or on your own machine. A brand file for
the video skill, if you make one, is saved in a folder named `.sheet-video` in your home folder. None of these files
are sent to us.

## Network use

- **Plan and review edition:** none. It holds only Markdown, JSON and an image, and makes no network requests.
- **Full edition, drawing skill:** none. Its build script uses the Python standard library only, and the HTML it writes
  makes no network requests.
- **Full edition, video skill:** a one-time setup, run only when you ask for a video, downloads six Python packages
  from the Python Package Index, the Chromium browser from Playwright's download servers, and a voice model from the
  kokoro-onnx project's release page on GitHub. Those services receive the ordinary information of a download request,
  such as your IP address, under their own policies. Nothing from your project is sent. After setup, the video skill
  runs on your machine.

## Retention

We keep nothing, because we receive nothing.

## Children

The plugin is meant for professionals and property owners. It is not intended for anyone under 18.

## Changes

Changes to this page are made in this file, and its history is public in the repository's git log.

## Contact

Open an issue at <https://github.com/oasiseng/Oasis-Blueprints/issues>, or use the contact page at
<https://oasisengineering.com/contact/>.
