# 🚀 ZeroCloud Engine (v2.0)

> A lightweight, self-hosted personal cloud vault that uses the Telegram Bot API as an unlimited storage backend, built with Node.js and Express.

⚠️ **Before anything else, read `SECURITY_NOTICE.md`.**

---

## 🌟 Features

- ♾️ **Unlimited Storage Bridge:** Seamlessly stream and upload files directly to your private Telegram Channel or Group.
- 🇮🇳 **Full UTF-8 / Unicode Support:** Flawlessly handles Hindi, regional scripts, and special character filenames without corruption or truncation.
- 👤 **Uploader Tracking System:** Automatically attaches the uploader’s username/ID and timestamp as a caption to every file sent to Telegram.
- 🎥 **Smart Streaming Engine:** Supports HTTP `Range` headers for fast, smooth video and audio previews directly in the browser without full downloads.
- 📊 **Real-time Analytics Dashboard:** Track storage usage, total vault file counts, and cloud protection status at a glance.
- 🧱 **Clean MVC Architecture:** Highly modular codebase with separated controllers, routes, services, and middleware for scalable development.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Storage Backend:** Telegram Bot API (`sendDocument`, `getFile`, Stream Pipe)
- **File Handling:** Multer, Axios, Form-Data
- **Database:** Atomic JSON-file persistence layer (`users.json`, `files.json`)
- **Frontend:** Vanilla HTML5, CSS3, JavaScript, FontAwesome 6 Icons

---

## 🚀 Getting Started

### 1. Installation

```bash
git clone https://github.com/test-book-by-sangam/zerocloud.git
cd zerocloud
npm install
