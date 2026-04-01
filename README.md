# ScenarijPro

ScenarijPro is a web application for creating and collaboratively editing scripts, developed as part of the *Web Technologies* course at the Faculty of Electrical Engineering, University of Sarajevo.

---

## Project Overview

ScenarijPro enables users to create, edit, and manage scripts in a structured format while supporting real-time collaboration through conflict prevention mechanisms.

The project was developed iteratively through multiple phases (*spirals*), gradually evolving from a static UI into a full-stack application with database integration and version control.

---

## Features
### Phase 1 – UI (HTML & CSS)
* Script overview page (projects dashboard)
* Script editor interface
* User settings page
* Responsive design (desktop & mobile)

### Phase 2 – Text Processing (JavaScript)
* Custom text editor module
* Word counting (including formatting detection)
* Character (role) recognition
* Detection of inconsistencies in character names
* Dialogue and scene analysis

### Phase 3 – Backend API (Node.js & Express)
* Create and retrieve scripts
* Line-level locking mechanism to prevent conflicts
* Line updates with automatic text wrapping
* Global character renaming across scripts
* Change tracking using a delta system
* File-based persistence using JSON

### Phase 4 – Database & Versioning
* Migration from JSON storage to MySQL database
* Sequelize ORM integration
* Data models: Scenario, Line, Delta, Checkpoint
* Checkpoint-based versioning system
* Scenario state reconstruction using deltas

---

## Tech Stack

* HTML5, CSS3
* Vanilla JavaScript
* Node.js
* Express.js
* MySQL
* Sequelize ORM


---

## Key Concepts

* Concurrency control using locking mechanisms
* Delta-based change tracking
* Checkpoint-based versioning
* RESTful API design
* Relational database modeling

---

##  Notes

This project was developed for educational purposes and demonstrates a progressive approach to building a full-stack application through iterative development phases.

