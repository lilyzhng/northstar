# Northstar - Inline Tag Task Board

An Obsidian plugin that automatically tracks tasks with **inline hashtags** in a sidebar board.

## How It Works

1. **Add inline hashtags to checkboxes**:
   ```markdown
   - [ ] #people follow up with hashbrown / Mike on benchmark ideas
   - [ ] #work review the PR
   - [ ] Regular task (won't appear on board)
   ```

2. **Tasks automatically appear on the board** grouped by their inline tags

3. **Check/uncheck on the board** updates the source file

4. **Click "×"** to remove a task from tracking

## Features

- **Inline tag detection** — Any `- [ ] #tag` checkbox automatically appears on the board
- **Multi-tag support** — Tasks with multiple tags (e.g. `- [ ] #work #urgent fix bug`) appear under each tag
- **Tag grouping** — Tasks organized by their inline hashtags
- **Live sync** — Checking tasks updates source files instantly
- **Source navigation** — Click note name to jump to that task
- **Collapsible sections** — Click topic headers to collapse/expand

## Settings

- **Excluded tags** — Tags to hide from the board
- **Show completed** — Toggle completed task visibility
- **Show source note** — Show/hide note name badges
- **Sort orders** — Alphabetical or by task count for topics; incomplete-first or by-file for tasks

## Example

```markdown
- [ ] #people follow up with hashbrown / Mike on benchmark ideas
- [ ] #work #urgent review pull request
- [x] #work update documentation
```

Tasks appear on the board under their respective tag sections (#people, #work, #urgent).
