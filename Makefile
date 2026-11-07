# The lead's CLI for the chess-trainer workflow comparison. Builds branch from the `base` tag and
# never see this file. Plan: ~/.claude/skills/workflow-compare/plans/chess-trainer.md

.DEFAULT_GOAL := help
.PHONY: help doctor setup puzzles launch checks shots round dry price clean

help: ## show this help
	@awk 'BEGIN {FS = ":.*?## "; printf "\n\033[1mUsage:\033[0m make \033[36m<target>\033[0m\n\n\033[1mTargets:\033[0m\n"} \
	     /^[a-z]+:.*?## / {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2} \
	     END {print ""}' $(MAKEFILE_LIST)

doctor: ## check required tools
	@bash scripts/doctor.sh

setup: ## first-time setup: npm, Chromium, python-chess, then doctor
	@bash scripts/setup.sh

puzzles: ## re-verify public/puzzles.json with python-chess
	@.venv/bin/python -I scripts/puzzles.py verify public/puzzles.json

launch: ## run one build: make launch v=A r=1
	@v=$(v) r=$(r) bash scripts/launch.sh

checks: ## code checks of one build into checks.md: make checks v=A r=1
	@v=$(v) r=$(r) bash scripts/checks.sh

shots: ## the 20 fixed shots of one build: make shots v=A r=1
	@v=$(v) r=$(r) bash scripts/shots.sh

round: ## launch, checks and shots for one build: make round v=A r=1
	@v=$(v) r=$(r) bash scripts/round.sh

dry: ## test the tooling on Haiku and a stub app (costs under one dollar)
	@bash scripts/dry.sh

price: ## billed price of every build so far, with cross-checks
	@python3 -I $(HOME)/.claude/skills/workflow-compare/scripts/blind.py price .workflow-compare/2026-11-07-chess-trainer

clean: ## remove build output and test results
	@bash scripts/clean.sh
