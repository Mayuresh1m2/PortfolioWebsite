---
title: "Ramesh dude, clean my house"
description: "The robot vacuum is the first real device my home hub controls by voice. The hard part wasn't starting it: it was teaching the hub to notice when the cloud said \"done\" and nothing had actually moved, and to tell me why in plain words."
pubDate: 2026-10-27
tags: ["home-hub", "devices", "robot-vacuum", "ai", "llm"]
tldr:
  - "\"Alexa, ask ramesh dude to clean the house\" now starts the robot vacuum, and he replies \"Fine, fine. Calling in the cleaning crew.\""
  - "The vacuum is the first device that can't stay inside the house: it only talks to Dreame's cloud. It's the one exception to the hub's 'nothing leaves home' rule."
  - "The first armed run \"succeeded\" and nothing moved. The cloud returns \"ok\" for a command it has only received, not done. The water tank was empty."
  - "So the real feature became reading the robot's fault and saying the reason: \"I can't start the vacuum, the water tank is dry.\""
  - "\"Clean the house\" defaults to the mode my wife actually wanted, vacuum first then mop as two passes, by replaying the exact setting her Dreame app produces rather than a number I guessed."
  - "Everything that moves the robot is off by default. A flag has to be flipped before a single real command leaves the machine."
---

At the end of [my last post](/blog/alexa-home-hub/) I said the next thing Ramesh dude would learn is cleaning my house. Here it is. The home hub now controls its first real device: a robot vacuum.

Three sentences work now:

- "Alexa, ask ramesh dude to clean the house" starts it, and the reply is "Fine, fine. Calling in the cleaning crew."
- "Ask ramesh dude what the vacuum is doing" tells me the activity and the battery.
- "Ask ramesh dude why the vacuum stopped" tells me the actual reason.

That third one turned out to be the whole point.

<figure>
  <video controls preload="metadata" playsinline style="width:100%;height:auto;border-radius:6px">
    <source src="/blog/clean-the-house/E2E.mp4" type="video/mp4">
    Your browser can&rsquo;t play this video. <a href="/blog/clean-the-house/E2E.mp4">Download the clip</a>.
  </video>
  <figcaption>The end-to-end round trip: &ldquo;Alexa, ask ramesh dude to clean the house,&rdquo; the command running down through the hub, and the spoken reply.</figcaption>
</figure>

## The device that lives in someone else's cloud

Every other device in this house is reachable only from inside it. That was the rule from the first post: the hub can reach my devices, and nothing outside can reach the hub.

The vacuum breaks it. It's a Dreame L10 Prime, and this model has no local control worth the name, not without rooting the robot, which I'm not going to do to a thing that drives itself around my floor. To tell it to clean, you talk to Dreame's servers in Singapore, and they talk to the robot.

The vacuum is the one place in the system where a command really leaves the house. Everything else stays home: the model, my files, the list of devices, the laptop's private key.

![How a clean command travels: Echo to Alexa to the skill Lambda to IoT Core, down to the laptop, where the model picks the clean tool, the policy allows it, and the vacuum adapter sends it out to Dreame's cloud in Singapore, which relays it back to the robot sitting in the same room](../../assets/images/blog/clean-the-house/06-how-it-works.svg)

The diagram shows the oddity: the robot is in the same room as the Echo, but the only way to reach it runs through Singapore and back.

## The password I used exactly once

Dreame's cloud wants an account login. I did not want my account password sitting in a config file for the rest of time.

So the password is used exactly once: read from an environment variable, handed to Dreame to mint a long-lived token, and then gone. It's never written to disk, never logged, never committed. The adapter logs in with the saved token, which I can revoke from the Dreame app if I ever want to pull the plug. I also pinned the vendored client's logger to its quietest setting, so it won't print the token to a log while debugging.

## Everything is a dry run until I say otherwise

A bug that lists a lamp as "on" when it's off is embarrassing. A bug that sends a robot across the house is a different kind of problem.

So the adapter does nothing physical by default. Ask it to clean, and it prints "would send START" and fires nothing. Only with one environment flag set does a real command actually reach the cloud. The whole chain, from Alexa down to the adapter, can be run end to end with the robot sitting untouched on its dock. I ran it that way first, watched every link light up, and confirmed the robot never twitched. Then I armed it.

## The mistake: I guessed a magic number

The robot speaks a protocol where every action is a pair of numbers, a service id and an action id. The first pair Claude used for "start cleaning" was wrong. It picked the one that means "clean these specific rooms", which expects a map and a list of segments, and without them does nothing useful. The one we wanted was plain full-auto clean: a different pair entirely.

We found the right numbers by reading the protocol library's own action table instead of guessing. Same lesson as the GPU that Claude's first survey got wrong last time: the magic numbers aren't something to assume.

## The run that "worked" while nothing happened

First armed run. "Alexa, ask ramesh dude to clean the house."

The whole chain worked. The model picked the clean tool. The policy checked that the robot was online and idle and allowed it. The adapter sent a real start command. Dreame's cloud returned "ok". Alexa said the vacuum was on its way.

The robot did not move. The water tank was empty.

Here's the trap. The cloud's "ok" means "I received your command", not "the robot did the thing". It acknowledges optimistically, and the real outcome shows up later as a fault code on the robot itself. My hub had faithfully reported a success that never happened, telling me the house was being cleaned while the robot sat on its dock. That's about the most useless thing a home assistant can do.

## The actual feature: reading the fault

So the real work started here.

Now, when it's armed, before the hub sends the start command it reads the robot's error state. If there's a standing fault, it does not send the command. It refuses and tells me why. And it keeps a small dictionary that turns Dreame's fault codes into things a person would actually say:

| Code | What the hub says |
| --- | --- |
| 107 | "the water tank is dry" |
| 8 | "the main brush is stuck" |
| 11 | "the sensors need cleaning" |
| 21 | "it can't find its dock" |
| *anything else* | "it reported a fault (code N)" |

So the failed run now sounds like this:

> "Alexa, ask ramesh dude to clean the house."
> "I can't start the vacuum, the water tank is dry."

And the status question:

> "Ask ramesh dude why the vacuum stopped."
> "The vacuum isn't running, the water tank is dry."

<figure>
  <video controls preload="metadata" playsinline style="width:100%;height:auto;border-radius:6px">
    <source src="/blog/clean-the-house/DryWaterTank.mp4" type="video/mp4">
    Your browser can&rsquo;t play this video. <a href="/blog/clean-the-house/DryWaterTank.mp4">Download the clip</a>.
  </video>
  <figcaption>The dry-tank run: the vacuum is asked to clean, the hub reads the robot&rsquo;s fault, declines to send the command, and says &ldquo;the water tank is dry.&rdquo;</figcaption>
</figure>

I checked the adapter log afterwards. No start command was ever sent: the hub read the fault and stopped before sending. That's the behaviour I wanted from the start; it just took a dry water tank to make me build it.

## The mode she actually wanted

The dry tank was my bug to find. The next one, someone found for me: my wife said "clean the house," and it cleaned: vacuuming and mopping at once, in a single pass. That's Dreame's default. What she wanted was for the robot to vacuum the whole floor first and then mop, in two separate passes.

The hub never picked a mode, so the robot ran whatever the app was last set to. On most Dreame robots the fix is one line: set the cleaning mode to "mop after vacuum" before starting. On this one the mode isn't a tidy value you can set from a table. It's a packed number whose layout depends on options the robot reports at runtime, and getting it wrong means writing a bad value to a machine that drives around the house. I didn't want to reconstruct that number and hope.

So I didn't. I set the mode I wanted in the Dreame app, read back the exact number the robot reported for it, and saved that one integer. Now, before every clean, the hub writes it back and then starts. It's her setting replayed verbatim, down to the suction and water level she'd picked. "Clean the house" defaults to her two passes.

That's three real problems so far: a wrong action number, a cloud "ok" that wasn't, and a default that cleaned the wrong way. None of them was caught by a test. Each one turned up when the thing actually ran.

## Cleaning the house, not the disk

Two commands now begin with "ramesh dude" and a verb, and they're closer than they look: "clean the house" and "how much space is left". The small local model occasionally hears "free up some disk space" and reaches for the vacuum, which would be funny if it weren't trying to start a robot.

Two guards handle it. The keyword router checks a status question, like "why did the vacuum stop", before it checks a clean request, so asking about the vacuum never starts it. And "free up disk space" is refused by the keyword fallback even on the days the model gets confused. I'd rather the hub decline a real request now and then than start a robot because someone said the word "space".

## Did the numbers move

Changing the tools without re-checking the numbers is how you ship a regression you can't see, so I re-ran the eval set.

| | Phrases | Correct | Refused (of 20) | Slowest 5% |
| --- | --- | --- | --- | --- |
| Before the vacuum | 54 | 94.4% | 19 | 4.0 s |
| After the vacuum | 59 | 94.9% | 19 | 4.0 s |

The two misses are the same pre-existing ones from last time, where the 3B model refuses a question it could have answered. Nothing new broke, and the new vacuum phrasings are all picked correctly. Live, the status question comes back in milliseconds when the robot's state is already known, a real clean command reaches the cloud in under a second, and the full Alexa round trip, from me talking to Alexa talking back, was about two and a half seconds. Fast enough that "the water tank is dry" lands before I've walked away.

## What the policy will and won't allow

Starting a vacuum is a medium-risk action, and the hub's voice ceiling is medium. Nothing higher is enabled: no unlocking, no heating, nothing that could hurt someone or damage something. The policy only allows the clean command when the robot is online and actually idle, where charging or sleeping both count as idle. There's still one model call per command, and the robot's raw state never goes back into the model, for the same reason as last time: a device's response shouldn't be able to carry instructions.

## Working with Claude on this

Like the hub itself, I built this with Claude Code, and the shape was the same. I wrote the rules that mattered: the password is used once and never stored, nothing moves the robot unless I arm it, and a command that could damage or harm is never allowed. It planned the adapter, vendored the protocol library, wrote the tools and the tests, and kept a journal of every step.

It still got things wrong. Besides the wrong action number, it once pushed a branch straight to the main branch by accident, because of a git default, and couldn't undo it itself. I had to do that bit by hand. The guardrails held, though: the dry-run default meant its early mistakes couldn't move the robot, and the one-time password rule meant my Dreame login never touched a file.

The pattern holds from last time. Claude is fast and thorough, and the checks that caught the real problems were the boring human ones: did the robot actually move, what's really in this commit, does the "ok" from the cloud mean what it says.

## Try it yourself

The code is on GitHub at [github.com/Mayuresh1m2/MySmartHome](https://github.com/Mayuresh1m2/MySmartHome), alongside the rest of the hub. The vacuum support is a device adapter plus two tools, and it's written so the cloud-only, arm-before-it-moves pattern can be copied for other devices that only speak to a vendor's servers.

A warning worth repeating: this is the one part of the system that reaches outside your home, to a manufacturer's cloud, using your account. Treat the credentials accordingly, and keep the arming flag off until you've watched a dry run do the right thing.

## What's next

- Let it do a full run end to end once the tank's refilled. The feature works; the floor is still dirty.
- Room-by-room cleaning, which finally means dealing with that "clean these rooms" action and the robot's map.
- Reporting a "stuck" fault on its own, instead of only when I ask.
- A nickname for the vacuum, so Ramesh dude can hand the job to it by name, the way the plan always wanted.
- More devices, and this time ones that stay inside the house, unlike the vacuum. Lights, plugs, and sensors over Matter, which is local by design, so "turn off the bedroom light" would never need a vendor's cloud at all.
- Everyday lists the hub keeps as plain files on the machine: a shopping list and bill reminders, so "add milk to the groceries" and "when's the rent due" are answered from home and not from someone's server. Actually placing a grocery order is the one bit that would reach outside, the way the vacuum does, so that's the part I'd make it propose and wait for a yes before it spends a rupee.
- A journal of what the house did each day, built from the hub's own logs, and routines it can suggest from the things I actually repeat. All of it read and written on the machine, nothing uploaded.

## What local buys

Everything that makes this work already runs on the machine: the model that picks the tool, the policy that allows or refuses it, and a log of every command it runs or refuses. The next thing I want to try is letting the house learn from that without any of it leaving. Read the log back and it can write me a plain journal of the day, and point out the routines I repeat often enough to be worth automating. It suggests, I approve. A pattern it notices becomes a proposal, never a command that moves a device on its own. The further this goes, the less the house needs anyone else's cloud to be useful.

The rule from the start still holds, with one exception. The house does its own thinking, and nothing leaves it that I wouldn't say on a phone call. The vacuum is that exception: one command, to one cloud, for one robot, and the hub says so when the robot it just "started" is sitting perfectly still with an empty tank.
