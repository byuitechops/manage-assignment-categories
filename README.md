# Manage Assignment Categories
### *Package Name*: manage-assignment-categories
### *Child Type*: post import
### *Platform*: online/pathway
### *Required*: Recommended

This child module is built to be used by the Brigham Young University - Idaho D2L to Canvas Conversion Tool. It utilizes the standard `module.exports => (course, stepCallback)` signature and uses the Conversion Tool's standard logging functions. You can view extended documentation [Here](https://github.com/byuitechops/d2l-to-canvas-conversion-tool/tree/master/documentation).

## Purpose

Under the Assignments tab, assignments are categorized by Lessons and have extra sections titled 'Imported Assignments' and 'Assignments' that are often empty. This child module is to delete the extra sections if they are empty, and is to rename all of the lesson sections to 'Week xx' sections.

## How to Install

```
npm install manage-assignment-categories
```

## Run Requirements

None 

## Options

None

## Outputs

None

## Process

1. Gets the assignment groups from Canvas
2. Changes the assignment group name if it says 'Lesson xx', 'Lxx', or 'Wxx'
3. Gets the assignments from Canvas
4. If there are no assignments associated to the 'Assignments' or 'Imported Assignments' assignment groups, then the groups are deleted

## Log Categories

- Renamed Assignment Group
- Deleted Assignment Group

## Requirements

Delete the 'Assignments' and 'Imported Assignments' assignment groups if they are empty, and change the group names that say 'Lesson xx', 'Lxx', and 'Wxx' to say 'Week xx'.