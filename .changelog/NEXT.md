## Added

- **M56: Telegram Bot Integration** — Telegram bot for external notifications and conversational commands. Configure bot token and chat ID in Settings. Forwards PortOS notifications (filterable by type) to Telegram with rate limiting. Bot commands: `/status`, `/goals`, `/agents`, `/checkin`, `/help`. Check-in responses are persisted for goal tracking.
- **M49 P1: Goal Todos & Progress Tracking** — Enhanced goal model with explicit progress percentage, todo sub-tasks (with priority and time estimates), velocity tracking (percent/month with trend), projected completion dates, and time tracking aggregates. Progress bar and todos visible in both goal list rows and detail panel.

## Changed

- **CoS feature-ideas task** — Agents now implement the next unchecked PLAN.md item instead of inventing features. When user clarification is needed, agents create a `.plan-questions.md` marker and a `plan_question` notification linking to the Documents tab. Added `{appId}` template variable for prompt linking.
