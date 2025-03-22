// ... [Previous code remains the same until updateHeader function] ...

function updateHeader(data: FetchedData): void {
  // Clear existing content first
  clearResults();

  title.textContent = `${data.details.title} (#${data.details.number})`;

  // Create the initial comment with the issue/PR body
  if (data.details.body) {
    // Check if we already have this content
    const existingBody = Array.from(conversation.children).find(child =>
      child.classList.contains('comment') &&
      child.querySelector('.comment-body')?.textContent?.includes(data.details.body)
    );

    if (!existingBody) {
      const div = document.createElement("div");
      div.className = "comment initial-comment";
      div.innerHTML = `
        <div class="comment-header">
          <div class="user-info">
            <img src="${data.details.user.avatar_url}" alt="${data.details.user.login}" class="avatar" />
            <a href="${data.details.user.html_url}" class="username">${data.details.user.login}</a>
          </div>
          <div class="timestamp">
            ${new Date(data.details.created_at).toLocaleString()}
          </div>
        </div>
        <div class="comment-body markdown">
          ${window.marked.parse(data.details.body)}
        </div>
      `;
      conversation.insertBefore(div, conversation.firstChild);
    }
  }
}

// ... [Rest of the code remains the same] ...
