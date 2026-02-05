# Consensus - Bible Study Tool

A modern, responsive web application for reading and studying the Bible with commentary support.

## Features

- 📖 **Complete Bible** - All 66 books of the Bible (World English Bible translation - public domain)
- 💬 **Commentary Support** - Currently includes Gavin Ortlund's commentary on Revelation
- 🔍 **Full-text Search** - Search across all Bible verses and available commentary
- ⭐ **Bookmarks** - Save verses and commentary with personal notes
- 📱 **Mobile-first Design** - Responsive interface with touch-friendly navigation
- 🎨 **Clean UI** - Modern, distraction-free reading experience

## Live Demo

Visit: [https://edydex.github.io/bible_study_tool/](https://edydex.github.io/bible_study_tool/)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/edydex/bible_study_tool.git
cd bible_study_tool

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build for Production

```bash
npm run build
```

### Deploy to GitHub Pages

```bash
npm run deploy
```

## Project Structure

```
src/
├── components/       # React components
│   ├── Header.jsx
│   ├── BibleChapter.jsx
│   ├── CommentarySidebar.jsx
│   ├── BookmarkManager.jsx
│   ├── SearchResults.jsx
│   └── MobileBottomNav.jsx
├── data/
│   ├── bible-web.json      # Complete WEB Bible (66 books)
│   ├── bible-books.js      # Book metadata
│   ├── ortlund-commentary.json
│   └── authors.js          # Commentary author management
├── hooks/
│   └── useBookmarks.js     # Bookmark persistence
└── App.jsx                 # Main application
```

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Navigation (HashRouter for GitHub Pages)
- **localStorage** - Bookmark persistence

## Bible Translation

This app uses the **World English Bible (WEB)** translation, which is in the public domain. The WEB is a modern English translation that is freely available for use without copyright restrictions.

## Contributing

Contributions are welcome! Feel free to:

- Add commentary from other authors/sources
- Improve the UI/UX
- Add new features (cross-references, parallel translations, etc.)
- Fix bugs or improve performance

### Adding New Commentary

Commentary data is stored in JSON format. To add new commentary:

1. Create a JSON file following the structure in `src/data/ortlund-commentary.json`
2. Register the author in `src/data/authors.js`
3. The sidebar will automatically pick up new authors and their works

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **World English Bible** - Public domain Bible translation
- **Gavin Ortlund** - Revelation commentary content
- Bible data sourced from [bolls.life API](https://bolls.life/)

## Roadmap

- [ ] Add more commentary sources
- [ ] Cross-reference support
- [ ] Reading plans
- [ ] Audio Bible integration
- [ ] Offline support (PWA)
- [ ] Notes and highlighting
- [ ] Share verses
