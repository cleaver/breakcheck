import http from "http";

const PORT = 3000;

// Simple routing table
const routes = {
  "/": "home",
  "/about": "about",
  "/contact": "contact",
  "/blog": "blog",
};

// Content for "after" version
const content = {
  home: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>My Website - Home</title>
      <link rel="stylesheet" href="/styles.css?v=1.0.1">
    </head>
    <body>
      <header>
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
            <li><a href="/blog">Blog</a></li>
          </ul>
        </nav>
      </header>
      <main>
        <h1>Welcome to My Website</h1>
        <img src="/images/hero.jpg?v=2.0.0" alt="Hero image">
        <p>This is the home page of our website.</p>
        <div class="featured-posts">
          <article id="post-789">
            <h2>Featured Post 1</h2>
            <p>This is a featured post with ID 789.</p>
          </article>
        </div>
      </main>
      <footer>
        <p>&copy; 2024 My Website</p>
      </footer>
    </body>
    </html>
  `,
  about: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>My Website - About</title>
      <link rel="stylesheet" href="/styles.css?v=1.0.1">
    </head>
    <body>
      <header>
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
            <li><a href="/blog">Blog</a></li>
          </ul>
        </nav>
      </header>
      <main>
        <h1>About Us</h1>
        <p>Learn more about our company.</p>
        <div class="team">
          <div class="member" id="member-2">
            <h3>John Doe</h3>
            <p>CEO</p>
          </div>
        </div>
      </main>
      <footer>
        <p>&copy; 2024 My Website</p>
      </footer>
    </body>
    </html>
  `,
  contact: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>My Website - Contact</title>
      <link rel="stylesheet" href="/styles.css?v=1.0.1">
    </head>
    <body>
      <header>
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
            <li><a href="/blog">Blog</a></li>
          </ul>
        </nav>
      </header>
      <main>
        <h1>Contact Us</h1>
        <form id="contact-form-2">
          <div class="form-group">
            <label for="name">Name:</label>
            <input type="text" id="name" name="name">
          </div>
          <div class="form-group">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email">
          </div>
          <button type="submit">Send</button>
        </form>
      </main>
      <footer>
        <p>&copy; 2024 My Website</p>
      </footer>
    </body>
    </html>
  `,
  blog: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>My Website - Blog</title>
      <link rel="stylesheet" href="/styles.css?v=1.0.1">
    </head>
    <body>
      <header>
        <nav>
          <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
            <li><a href="/blog">Blog</a></li>
          </ul>
        </nav>
      </header>
      <main>
        <h1>Blog</h1>
        <article class="post" id="post-999">
          <h2>First Blog Post</h2>
          <p>This is our first blog post.</p>
        </article>
      </main>
      <footer>
        <p>&copy; 2024 My Website</p>
      </footer>
    </body>
    </html>
  `,
};

const server = http.createServer((req, res) => {
  const path = req.url;

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/html");

  // Handle routes
  if (routes[path]) {
    res.writeHead(200);
    res.end(content[routes[path]]);
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`Test server (after) running at http://localhost:${PORT}`);
});
