# Technical Context

## Development Environment

### Core Technologies
- HTML5
- CSS3
- JavaScript (ES6+)
- Markdown (GitHub Flavored)

### External Dependencies
```json
{
  "dependencies": {
    "marked": "^4.0.0"  // Markdown parsing library
  }
}
```

### Browser Support
- Modern browsers with ES6 support
- No polyfills required
- Local file system access needed

## Project Setup

### Directory Structure
```
.
├── src/               # Source code
│   ├── comment-scores.html    # Latest visualization
│   ├── score-comparison-v2.html
│   ├── score-comparison.html
│   └── score-visualization.html
├── data/              # Data files
│   ├── pr_details.json
│   ├── pr_comments.json
│   └── issue_comments.json
└── docs/              # Documentation
    └── project-context.md
```

### Code Organization

#### HTML Structure
```html
<!DOCTYPE html>
<html>
  <head>
    <!-- Marked.js for markdown rendering -->
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <!-- Inline styles for simplicity -->
    <style>...</style>
  </head>
  <body>
    <!-- Content containers -->
    <div class="algorithm-description">...</div>
    <div id="results"></div>
    <!-- Core logic -->
    <script>...</script>
  </body>
</html>
```

#### CSS Architecture
- BEM-like naming conventions
- Component-based organization
- Responsive design principles
- GitHub-inspired styling

## Technical Constraints

### Browser Limitations
- Local file access required
- CORS considerations for external resources
- Memory constraints for large datasets

### Performance Targets
- Initial load < 2s
- Smooth scrolling with 100+ comments
- Responsive to window resizing
- Efficient markdown parsing

### Security Considerations
- Safe markdown parsing
- XSS prevention in rendered content
- Content sanitization

## Development Workflow

### Local Development
1. Edit HTML/CSS/JS files directly
2. Refresh browser to see changes
3. Use browser dev tools for debugging

### Testing Process
- Manual testing in browsers
- Visual regression checks
- Performance monitoring
- Cross-browser verification

### Deployment
- Static file hosting
- No build process needed
- Direct browser loading

## Tools & Utilities

### Essential Tools
- Modern web browser
- Text editor with syntax highlighting
- Git for version control

### Browser Dev Tools Usage
- Elements panel for DOM inspection
- Console for debugging
- Network tab for performance
- Sources for debugging

### Testing Tools
- Browser console
- Performance profiler
- Memory usage monitoring

## Technical Debt

### Current Limitations
- No automated tests
- Manual data updates
- Limited error handling
- Basic performance optimization

### Future Technical Needs
1. Build system for production
2. Automated testing suite
3. Error tracking system
4. Performance monitoring
5. API integration capabilities

## Documentation Standards

### Code Documentation
- Clear function naming
- JSDoc comments for complex logic
- Inline comments for algorithms
- README updates for changes

### Technical Specs
- Algorithm documentation
- Data format specifications
- Performance requirements
- Browser compatibility notes

### Maintenance Guide
1. Keep dependencies minimal
2. Document all changes
3. Update examples
4. Test cross-browser

## Technical Resources

### References
- [Marked.js Documentation](https://marked.js.org/)
- [GitHub Markdown Guide](https://guides.github.com/features/mastering-markdown/)
- [MDN Web Docs](https://developer.mozilla.org/)

### Tools Documentation
- Browser Developer Tools
- Git Version Control
- VS Code Editor

### Learning Resources
- JavaScript ES6+ features
- CSS Grid and Flexbox
- Markdown parsing concepts
- Performance optimization
