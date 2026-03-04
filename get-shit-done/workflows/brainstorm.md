<purpose>
Run a collaborative brainstorming session: explore project context, ask clarifying questions one at a time, then propose 2-3 distinct approaches with trade-offs and a stated recommendation.

You are a thinking partner. The user has an idea — your job is to understand it deeply through context and questions, then propose structured approaches they can evaluate. Ground everything in the actual project state.
</purpose>

<process>

## 1. Parse Topic

Extract topic from $ARGUMENTS.

**If topic provided:** Store as $TOPIC, display:
```
Starting brainstorm session on: {$TOPIC}
```

**If no topic provided:** Prompt the user:

Use AskUserQuestion:
- header: "Brainstorm"
- question: "What would you like to brainstorm about?"

Store response as $TOPIC.

## 2. Explore Project Context

Read project files to ground the session in the actual project state. Do this BEFORE asking any questions.

**Read these files (if they exist):**
- `.planning/PROJECT.md` — project purpose and core value
- `.planning/REQUIREMENTS.md` — existing requirements
- `.planning/ROADMAP.md` — current phases and progress
- `.planning/STATE.md` — current position and recent activity

**Read recent git history:**
```bash
git log --oneline -20
```

**Scan codebase for topic relevance:**
Use Glob and Grep based on topic keywords to find relevant source files, patterns, or existing implementations.

**Present findings to user:**

```
## Here's what I found

**Project:** {project name and focus from PROJECT.md}
**Current state:** {current phase/milestone from STATE.md}

**Relevant to "{$TOPIC}":**
- {Finding 1 — existing code, patterns, or requirements related to the topic}
- {Finding 2}
- {Finding 3}

{If nothing relevant found: "No existing code or requirements directly related to this topic."}
```

## 3. Ask Clarifying Questions

Ask 3-5 clarifying questions one at a time using AskUserQuestion. Adapt each question based on previous answers.

**Question focus areas:**
1. **Purpose/goal** — What outcome does the user want? What problem does this solve?
2. **Constraints** — What limitations, requirements, or boundaries exist?
3. **Success criteria** — How will the user know this worked?
4. **Preferences** — Any specific approaches, patterns, or styles preferred?
5. **Additional context** — Anything else relevant? (optional, ask only if needed)

**For each question:**
- Prefer multiple choice format when options are enumerable (use options parameter in AskUserQuestion)
- Use open-ended format when the domain is too broad for pre-set options (omit options parameter)
- Reference project context from step 2 to make questions specific and grounded

**After each answer:** Incorporate the response into your understanding before asking the next question. Skip questions that have already been answered.

## 4. Propose Approaches

Based on context exploration and clarifying answers, propose 2-3 distinct approaches.

**Present each approach:**

```
## Proposed Approaches

### Approach 1: {Name}

{Description — 2-3 sentences explaining the approach and how it addresses the user's goal}

**Pros:**
- {Advantage}
- {Advantage}

**Cons:**
- {Disadvantage}
- {Disadvantage}

### Approach 2: {Name}

{Description}

**Pros:**
- {Advantage}
- {Advantage}

**Cons:**
- {Disadvantage}
- {Disadvantage}

### Approach 3: {Name} (if warranted)

{Description}

**Pros:**
- {Advantage}
- {Advantage}

**Cons:**
- {Disadvantage}
- {Disadvantage}
```

**State a recommendation:**

```
### Recommendation

I recommend **Approach {N}: {Name}** because {reasoning tied to user's stated goals and constraints}.
```

**Ask user to select:**

Use AskUserQuestion:
- header: "Approach Selection"
- question: "Which approach would you like to go with?"
- options: List each approach name plus "Let me suggest modifications"

**If user selects an approach:** Confirm selection and proceed to step 5.

**If user wants modifications:** Ask what they would change, revise the approaches incorporating their feedback, and re-present.

## 5. Session Complete

After approach selection, display:

```
Approach selected: {Name}

This brainstorming session is complete. The selected approach is ready for further development.
```

</process>
