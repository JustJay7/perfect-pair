# Safety rules (policy engine)

Checked in code before every action the agent takes. At the event, the Cedar policies below go into AgentCore Policy on the Gateway; the data checks stay inside each Lambda.

| Rule | Name | What it does | Policy | Enforced by |
|---|---|---|---|---|
| R1 | Money limit | The agent approves refunds, credits and exchanges up to $250 per return. Above that, a person approves first. | §7.1 | Cedar |
| R2 | Bonus cap | An in-store bonus is at most 10% of the credit, capped at $25, valid at most 30 days. | §5.1 | Cedar |
| R3 | Exchange needs a held pair | An exchange is created only against a pair held for this return. A price difference over $50 needs a person. | §4.2 | Cedar and tool |
| R4 | Fees only go down | The return label fee is never above $5.95. | §3.2 | Cedar |
| R5 | No fee when we caused it | No fee when ALDO, the carrier or a defect caused the return, for exchanges and Smart Credit, or for store drop-offs. | §3.3 | Tool (checks the data) |
| R6 | Waivers need a reason | A change-of-mind refund by mail pays $5.95 unless a §3.3 reason applies. | §3.2, §3.3 | Tool (checks the data) |
| R7 | Keep-it tests | A refund without the return only when every keep-it test passes. | §6.1 | Cedar and tool |
| R8 | Suspected abuse | Any money action on a case flagged for possible abuse waits for a supervisor. | §7.1, §7.2 | Tool (case record) |
| R9 | Claims need evidence | A carrier or supplier claim needs tracking or defect evidence. | §3.3 | Tool (checks the data) |
| R10 | Merchandiser approves page changes | A product page change waits for a merchandiser. | §7.3 | Cedar |
| R11 | Settle after the check | Nothing is paid or shipped until the returned pair passes the quality check: refunds, store credit (with any bonus) and exchange pairs all wait. The check happens at the store counter on drop-off, or at the distribution centre for mailed returns. Keep-it refunds are the only exception: nothing comes back to check. | §3.1 | Tool (customer record) |
| R13 | Release after inspection | The quality check decides what was held. Same or better grade than the customer's photo, indoor try-on marks (B) or a defect (D): the refund, credit or exchange is released automatically. A worn pair (C) that contradicts the photo: everything stays on hold for the store manager, with a recommendation. | §2.4, §7.2 | Tool (counter grade) |
| R12 | Stock holds | A hold needs a pair available to promise at that location. | §4.2 | Tool |

## Cedar policies for AgentCore Policy

```cedar
// Perfect Pair · Resolution agent policy for AgentCore Policy (ENFORCE mode).
// Gateway target "ReturnsTools". Money is passed in integer cents, because
// Cedar compares whole numbers. Anything not permitted is denied, and a
// forbid always wins. Read-only tools get a plain permit (not shown).

// R1 · Money limit (§7.1): the agent alone refunds up to $250.
permit (
  principal,
  action == AgentCore::Action::"ReturnsTools___issue_refund",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when { context.input.amount_cents <= 25000 };

// R1 · Above $250, only a session resumed by an approver (Step Functions).
// Assumes the Gateway passes the caller's role as a principal tag:
// confirm this with the AWS mentors.
permit (
  principal,
  action == AgentCore::Action::"ReturnsTools___issue_refund",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when {
  principal.hasTag("role") && principal.getTag("role") == "approver" &&
  context.input.amount_cents <= 50000
};

// R2 · Smart Credit (§5.1): credit up to $250, bonus at most $25 for 30 days.
permit (
  principal,
  action == AgentCore::Action::"ReturnsTools___issue_store_credit",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when {
  context.input.amount_cents <= 25000 &&
  context.input.bonus_cents <= 2500 &&
  context.input.bonus_valid_days <= 30
};

// R3 · An exchange needs a held pair (§4.2); the Lambda checks the hold.
permit (
  principal,
  action == AgentCore::Action::"ReturnsTools___create_exchange",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when {
  context.input has hold_id &&
  context.input.price_difference_cents <= 5000
};

// R4 · Fees only go down (§3.2): never above $5.95.
permit (
  principal,
  action == AgentCore::Action::"ReturnsTools___create_return_label",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when { context.input.customer_fee_cents <= 595 };

// R7 · Keep-it refunds only under $40 (§6.1); the Lambda checks the rest.
forbid (
  principal,
  action == AgentCore::Action::"ReturnsTools___issue_refund",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when {
  context.input has keep_item && context.input.keep_item &&
  context.input.amount_cents >= 4000
};

// R10 · The agent drafts product page notes; only a merchandiser publishes (§7.3).
permit (
  principal,
  action == AgentCore::Action::"ReturnsTools___update_product_info",
  resource == AgentCore::Gateway::"<gateway-arn>"
) when { principal.hasTag("role") && principal.getTag("role") == "merchandiser" };
```
