# RoboGaze: Evaluating Robot World Models via Structured Vision-Language Analysis

**Project page:** https://robogazeproject.github.io/RoboGazeProject/

## Abstract

Robot world models now generate synthetic manipulation videos, but evaluating them is hard: realistic-looking outputs often violate physical laws, temporal consistency or task logic, while conventional metrics and monolithic Vision-Language Model (VLM) judges return scores that do not say what failed. We present **RoboGaze**, a training-free multi-agent VLM evaluator that grounds the task and scene, routes each subtask to dimension-specific specialists and verifies their findings with a critic, producing temporally localized diagnostic reports that state what failed, when, why and how severely, under a schema of 6 dimensions and 30 failure types whose annotation reliability and coverage we measure. To benchmark it, we introduce **RoboGazeBench**, 914 human-annotated clips from five generators, conditioned on simulated and real-world data and running from 4.9 to 148.9 s. Across eight open-source and proprietary VLM backbones, RoboGaze outperforms every baseline; even a published agentic detector given the same schema and a slightly larger inference budget trails it by 10.1–12.3 description-F1 points, a margin that blinded human raters confirm. On the strongest backbone it closes 83% of the gap between chain-of-thought prompting and human agreement, and its critic curbs the "cry-wolf" false positives of standard VLMs, lifting mean clean-clip accuracy from 17% to 85%. The advantage is largest on held-out generators and long clips, and carries over to selecting generated demonstrations (80% vs. 71% precision).

## About this repository

This repository hosts the static project page for an anonymous submission under double-blind review. It contains no author information. Code and the benchmark will be made public upon acceptance.

To view the page locally:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```
