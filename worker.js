// Hoang Editor — Auto-Post Worker
// Daily cron: generates a blog post via DeepSeek, deploys to GitHub
// Deploy: npx wrangler deploy

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binStr = '';
  for (let i = 0; i < bytes.length; i++) {
    binStr += String.fromCharCode(bytes[i]);
  }
  return btoa(binStr);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Serve images from R2 bucket
    if (url.pathname.startsWith("/images/")) {
      const key = url.pathname.replace("/images/", "");
      try {
        const obj = await env.BLOG_IMAGES.get(key);
        if (!obj) return new Response("Not Found", { status: 404 });
        return new Response(obj.body, {
          headers: {
            "Content-Type": obj.httpMetadata?.contentType || "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
            "Access-Control-Allow-Origin": "*"
          }
        });
      } catch (e) {
        return new Response("Not Found", { status: 404 });
      }
    }

    // Generate only image: POST /generate-image { topic: "..." }
    if (url.pathname === "/generate-image" && request.method === "POST") {
      try {
        const body = await request.json();
        const topic = body.topic || "real estate video editing";
        const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 40);
        const filename = `blog/${slug}.jpg`;

        // Check if already exists
        const existing = await env.BLOG_IMAGES.get(filename);
        if (existing) {
          return new Response(JSON.stringify({
            url: `https://hoang-editor-auto-post.hoangf29.workers.dev/images/${filename}`
          }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        }

        const prompt = `Professional real estate video editing blog featured image. ${topic}. Cinematic, modern, clean design with warm lighting, luxury real estate aesthetic. High quality, minimalist composition with subtle gold and dark tones. No text.`;
        const aiResp = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt, num_steps: 4 });
        const stream = (aiResp && aiResp.image) ? aiResp.image : aiResp;
        const text = await new Response(stream).text();
        const binaryStr = atob(text.replace(/^data:image\/\w+;base64,/, ''));
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        await env.BLOG_IMAGES.put(filename, bytes, {
          httpMetadata: { contentType: "image/jpeg" }
        });

        return new Response(JSON.stringify({
          url: `https://hoang-editor-auto-post.hoangf29.workers.dev/images/${filename}`
        }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // Manual trigger for testing: POST /__trigger
    if (url.pathname === "/__trigger" && request.method === "POST") {
      try {
        await runAutoPost(env);
        return new Response("OK — post published!", { status: 200 });
      } catch (e) {
        return new Response("Error: " + e.message, { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAutoPost(env));
  }
};

async function runAutoPost(env) {
  try {
    console.log('Auto-post cron triggered at', new Date().toISOString());

    // 1. Pick a random topic
    const topics = [
      "How to Price Your Real Estate Video Services for Maximum Profit",
      "10 Drone Shots That Make Luxury Listings Look Unforgettable",
      "Real Estate Videographer Guide to Client Retention",
      "How to Edit Property Tours That Get More Views on Social Media",
      "5 Common Editing Mistakes That Make Listings Look Cheap",
      "Why Top Videographers Are Outsourcing Post-Production in 2026",
      "Speed Ramping for Cinematic Property Walkthroughs Guide",
      "Lighting Tips for Real Estate Videography: Natural vs Artificial",
      "Build a 6-Figure Real Estate Video Business Without In-House Editor",
      "Best Music Choices for Different Types of Real Estate Videos",
      "How to Edit Agent Branding Videos That Convert Viewers to Clients",
      "Real Estate Video Trends That Will Dominate 2027",
      "Beginner Guide to Color Grading Real Estate Footage",
      "How to Scale from Solo Shooter to Full Production Company",
      "Psychology of Property Video: Why Some Listings Sell Faster",
      "Edit Vertical Videos for Instagram and TikTok Real Estate",
      "Essential Equipment for Real Estate Videographers 2026",
      "How to Write Shot Lists That Make Editing Twice as Fast",
      "Difference Between Good and Great Real Estate Video Editing",
      "How Fast Turnaround Times Win More Real Estate Clients",
      "AI Tools to Enhance Real Estate Video Production Workflow",
      "Complete Guide to Real Estate Video Audio Post-Production",
      "How to Price Luxury vs Standard Real Estate Video Packages",
      "5 Ways to Make Real Estate Videos Stand Out in Crowded Market",
      "How to Edit Twilight and Evening Property Tours for Impact",
      "Business Case for Outsourcing Real Estate Video Editing",
      "How to Create Consistent Look Across All Real Estate Videos",
      "Real Estate Video SEO: Rank Your Videos on YouTube and Google",
      "How to Transition from Real Estate Photography to Videography",
      "Why Outsourcing Your Video Editing Is the Key to Scaling Fast"
    ];

    const topic = topics[Math.floor(Math.random() * topics.length)];
    console.log('Selected topic:', topic);

    // 2. Generate post via DeepSeek
    const post = await generatePost(env.DEEPSEEK_KEY, topic);
    console.log('Generated post:', post.title);

    // 3. Generate featured image via Workers AI (cron has enough time)
    let imageUrl = null;
    try {
      imageUrl = await generateImage(env.AI, env.BLOG_IMAGES, topic, post);
      console.log('Generated image:', imageUrl);
    } catch (e) {
      console.log('Image generation failed, continuing without image:', e.message);
    }

    // 4. Deploy to GitHub
    await deployToGitHub(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO, post, imageUrl);
    console.log('Deployed to GitHub:', post.title);

    // 4. Update posts-data.js
    await updatePostsData(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO, post);
    console.log('Posts data updated');

    // 5. Update sitemap
    await updateSitemap(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO, post);
    console.log('Sitemap updated');

  } catch (e) {
    console.log('Auto-post FAILED:', e.message, e.stack);
    throw e; // Re-throw so caller knows it failed
  }
}

async function generatePost(apiKey, topic) {
  const today = new Date().toISOString().split('T')[0];

  const sysPrompt = `You are an expert SEO blog writer for Hoang Editor, a professional real estate video editing service. Our audience: real estate video shooters, videographers, and production teams who want to outsource post-production.

Write a 500-800 word blog post. Use proper HTML: <h2> for sections, <h3> for subsections, <p> for paragraphs, <ul><li> for lists, <blockquote> for quotes, <strong> for emphasis.

Include these keywords naturally: real estate video editing, video post-production, property tour, real estate videographer, outsourced video editing, video editing partner, production team.

End with: <div class="post-cta"><h3>Ready to scale your video business?</h3><p>We edit real estate videos so you can focus on shooting.</p><a href="https://hoangeditor.com/#contact" class="cta-btn">Start a Project →</a></div>

Output ONLY valid JSON, no other text:
{"title":"...","description":"120-155 char meta description...","tags":"Tag1, Tag2, Tag3","date":"${today}","readTime":"4 min read","content":"<full HTML body with H2/H3 tags>"}`;

  const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: "Write a blog post about: " + topic }
      ],
      temperature: 0.7,
      max_tokens: 3000
    })
  });

  if (!resp.ok) {
    throw new Error("DeepSeek API error: " + resp.status + " " + (await resp.text()));
  }

  const data = await resp.json();
  const choice = data.choices?.[0] || {};
  const msg = choice.message || {};
  // Try multiple possible content locations for different model versions
  const text = msg.content || msg.reasoning_content || choice.text || '';
  console.log('Content length:', text.length, 'Message keys:', JSON.stringify(Object.keys(msg)));

  // Extract JSON from response — handle markdown code blocks
  let jsonText = text;
  const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) jsonText = codeMatch[1];
  const match = jsonText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not parse JSON from AI response. Raw: " + text.substring(0, 200));
  return JSON.parse(match[0]);
}

async function generateImage(ai, bucket, topic, post) {
  // Build a descriptive prompt for the featured image
  const prompt = `Professional real estate video editing blog featured image. ${topic}. Cinematic, modern, clean design with warm lighting, luxury real estate aesthetic. High quality, minimalist composition with subtle gold and dark tones. No text in the image.`;

  const inputs = {
    prompt: prompt,
    num_steps: 4  // Fast generation (flux-schnell works well with 4 steps)
  };

  const response = await ai.run("@cf/black-forest-labs/flux-1-schnell", inputs);

  // Flux returns { image: ReadableStream<Uint8Array> } or ReadableStream directly
  let imageStream;
  if (response && typeof response === 'object' && response.image) {
    // Object wrapper: { image: ReadableStream }
    imageStream = response.image;
  } else if (response && typeof response.pipeTo === 'function') {
    // ReadableStream directly
    imageStream = response;
  } else {
    throw new Error("Unexpected AI response format: " + JSON.stringify(Object.keys(response || {})));
  }

  // Read the stream as text (AI returns base64-encoded JPEG)
  const text = await new Response(imageStream).text();
  // Decode base64 to binary
  const binaryStr = atob(text.replace(/^data:image\/\w+;base64,/, ''));
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // Generate slug for filename
  const slug = post.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 40);
  const filename = `blog/${slug}.jpg`;

  // Upload to R2
  await bucket.put(filename, bytes, {
    httpMetadata: { contentType: "image/jpeg" }
  });

  // Return the public URL
  return `https://hoang-editor-auto-post.hoangf29.workers.dev/images/${filename}`;
}

async function deployToGitHub(token, user, repo, post, imageUrl) {
  const slug = post.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 60);

  const html = buildHTML(post, slug, imageUrl);

  const resp = await fetch(
    `https://api.github.com/repos/${user}/${repo}/contents/blog/posts/${slug}.html`,
    {
      method: "PUT",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "HoangEditor"
      },
      body: JSON.stringify({
        message: "Auto-publish: " + post.title,
        content: toBase64(html),
        branch: "main"
      })
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    let errMsg = resp.status;
    try { errMsg = JSON.parse(text).message || resp.status; } catch (e) { errMsg = text.substring(0, 200); }
    throw new Error("GitHub deploy failed: " + errMsg);
  }
}

function buildHTML(post, slug, imageUrl) {
  const d = new Date(post.date + "T00:00:00");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dateStr = months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  const primaryTag = (post.tags || "").split(",")[0].trim() || "General";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${post.title} — Hoang Editor Blog</title>
<meta name="description" content="${post.description || ''}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://hoangeditor.com/blog/posts/${slug}.html">
<meta property="og:type" content="article">
<meta property="og:title" content="${post.title}">
<meta property="og:description" content="${post.description || ''}">
<meta property="og:url" content="https://hoangeditor.com/blog/posts/${slug}.html">
<meta property="og:image" content="${imageUrl || 'https://hoangeditor.com/Hoangeditor.PNG'}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="https://hoangeditor.com/Hoangeditor.PNG">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Merriweather:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link rel="stylesheet" href="../styles.css">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","headline":"${post.title}","url":"https://hoangeditor.com/blog/posts/${slug}.html","datePublished":"${post.date}","dateModified":"${post.date}","author":{"@type":"Person","name":"Hoang Editor Team"},"publisher":{"@type":"Organization","name":"Hoang Editor"}}</script>
</head>
<body>
<div class="bg-gradient" aria-hidden="true"></div>
<div class="bg-grain" aria-hidden="true"></div>

<header class="site-header">
<div class="header-inner"><div class="header-pill">
<a href="https://hoangeditor.com" class="logo"><span class="logo-mark"><i class="fas fa-play"></i></span><span class="logo-text">Hoang Editor</span></a>
<nav><ul class="nav-links">
<li><a href="https://hoangeditor.com/#services">Services</a></li>
<li><a href="https://hoangeditor.com/#workflow">Process</a></li>
<li><a href="https://hoangeditor.com/#pricing">Pricing</a></li>
<li><a href="../index.html" class="nav-active">Blog</a></li>
<li><a href="https://hoangeditor.com/#contact">Contact</a></li>
</ul></nav>
<a href="https://hoangeditor.com/#contact" class="btn-pill">Get Started <i class="fas fa-arrow-right" style="font-size:.7rem"></i></a>
<button class="theme-toggle" id="theme-toggle"><i class="fas fa-moon"></i></button>
<button class="menu-toggle" aria-label="Menu"><i class="fas fa-bars"></i></button>
</div></div>
<div class="mobile-menu">
<a href="https://hoangeditor.com/#services">Services</a>
<a href="https://hoangeditor.com/#workflow">Process</a>
<a href="https://hoangeditor.com/#pricing">Pricing</a>
<a href="../index.html">Blog</a>
<a href="https://hoangeditor.com/#contact">Contact</a>
</div>
</header>

<article class="post-article">
<div class="breadcrumbs"><a href="https://hoangeditor.com">Home</a><span class="sep">/</span><a href="../index.html">Blog</a><span class="sep">/</span><span>${post.title}</span></div>
<header class="post-header">
<a href="../index.html" class="post-category">${primaryTag}</a>
<h1>${post.title}</h1>
<div class="post-meta-row">
<div class="author-info"><div class="author-avatar">HE</div><div><span class="author-name">Hoang Editor Team</span><br><span>${dateStr}</span></div></div>
<span class="meta-sep"></span><span>${post.readTime || '4 min read'}</span>
<div class="post-share"><span>Share</span>
<a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=https://hoangeditor.com/blog/posts/${slug}.html" target="_blank"><i class="fab fa-x-twitter"></i></a>
<a href="https://www.linkedin.com/sharing/share-offsite/?url=https://hoangeditor.com/blog/posts/${slug}.html" target="_blank"><i class="fab fa-linkedin-in"></i></a>
<a href="#" onclick="navigator.clipboard.writeText('https://hoangeditor.com/blog/posts/${slug}.html');return false"><i class="fas fa-link"></i></a>
</div>
</div>
</header>

${imageUrl ? `<figure class="post-featured-image"><img src="${imageUrl}" alt="${post.title}" loading="lazy" style="width:100%;max-width:800px;border-radius:12px;margin-bottom:2rem"></figure>` : ''}
<div class="post-body">
${post.content || ''}
</div>

<div class="post-author-box">
<div class="author-avatar-lg">HE</div>
<div class="author-bio"><div class="author-name-lg">Hoang Editor Team</div><div class="author-desc">Professional real estate video editing partner for shooters and production teams. We help videographers scale by handling post-production.</div></div>
</div>

<div class="post-cta"><h3>Ready to scale your video business?</h3><p>We edit real estate videos so you can focus on shooting and growing your client base.</p><a href="https://hoangeditor.com/#contact" class="cta-btn"><i class="fas fa-arrow-right"></i> Start a Project</a></div>
</article>

<footer class="blog-footer"><p>&copy; ${d.getFullYear()} Hoang Editor Blog. <a href="https://hoangeditor.com" style="color:var(--gold-400);text-decoration:none">hoangeditor.com</a></p></footer>

<script>
(function(){var tt=document.getElementById("theme-toggle");if(tt){var h=document.documentElement,ti=tt.querySelector("i");if(localStorage.getItem("theme")==="dark"){h.setAttribute("data-theme","dark");ti.className="fas fa-sun"}tt.onclick=function(){var d=h.getAttribute("data-theme")==="dark";if(d){h.removeAttribute("data-theme");ti.className="fas fa-moon";localStorage.setItem("theme","light")}else{h.setAttribute("data-theme","dark");ti.className="fas fa-sun";localStorage.setItem("theme","dark")}}}var hd=document.querySelector(".site-header");if(hd)window.addEventListener("scroll",function(){hd.classList.toggle("scrolled",window.scrollY>40)},{passive:!0});var tg=document.querySelector(".menu-toggle"),mn=document.querySelector(".mobile-menu");if(tg&&mn){var op=!1;tg.addEventListener("click",function(){op=!op;mn.classList.toggle("open",op);tg.innerHTML=op?'<i class="fas fa-times"></i>':'<i class="fas fa-bars"></i>';document.body.style.overflow=op?"hidden":""});mn.querySelectorAll("a").forEach(function(l){l.addEventListener("click",function(){op=!1;mn.classList.remove("open");tg.innerHTML='<i class="fas fa-bars"></i>';document.body.style.overflow=""})})}})();
</script>
</body>
</html>`;
}

async function updatePostsData(token, user, repo, post) {
  const slug = post.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 60);
  const entry = `  {
    slug: "${slug}",
    title: "${post.title.replace(/"/g, '\\"')}",
    description: "${(post.description || '').replace(/"/g, '\\"')}",
    date: "${post.date}",
    readTime: "${post.readTime || '4 min read'}",
    category: "${(post.tags || '').split(',')[0].trim() || 'General'}",
    icon: "fa-file-lines"
  },\n`;

  // Fetch current posts-data.js
  const getResp = await fetch(
    `https://api.github.com/repos/${user}/${repo}/contents/blog/posts-data.js`,
    { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "HoangEditor" } }
  );
  if (!getResp.ok) { console.log('Could not fetch posts-data.js'); return; }

  const data = await getResp.json();
  const current = atob(data.content);

  // Check if slug already exists
  if (current.includes(`slug: "${slug}"`)) { console.log('Post already in posts-data.js'); return; }

  // Insert new entry after "var BLOG_POSTS = ["
  const updated = current.replace('var BLOG_POSTS = [\n', 'var BLOG_POSTS = [\n' + entry);

  await fetch(`https://api.github.com/repos/${user}/${repo}/contents/blog/posts-data.js`, {
    method: "PUT",
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "HoangEditor"
    },
    body: JSON.stringify({
      message: "Update posts-data: " + post.title,
      content: toBase64(updated),
      sha: data.sha,
      branch: "main"
    })
  });
}

async function updateSitemap(token, user, repo, post) {
  const slug = post.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 60);

  // Fetch current sitemap
  const getResp = await fetch(
    `https://api.github.com/repos/${user}/${repo}/contents/sitemap.xml`,
    { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "HoangEditor" } }
  );

  let sitemap;
  if (getResp.ok) {
    const data = await getResp.json();
    sitemap = atob(data.content);
  } else {
    // Create new sitemap if none exists
    sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset\n  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n\n  <url>\n    <loc>https://hoangeditor.com/</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n    <image:image>\n      <image:loc>https://hoangeditor.com/Hoangeditor.PNG</image:loc>\n      <image:title>Hoang Editor — Real Estate Video Editing</image:title>\n      <image:caption>Professional real estate video editing services for videographers and production teams.</image:caption>\n    </image:image>\n  </url>\n\n  <url>\n    <loc>https://hoangeditor.com/blog/</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>\n\n</urlset>\n`;
  }

  // Add new post URL if not already present
  const postUrl = `https://hoangeditor.com/blog/posts/${slug}.html`;
  if (!sitemap.includes(postUrl)) {
    sitemap = sitemap.replace('</urlset>',
      `  <url>\n    <loc>${postUrl}</loc>\n    <lastmod>${post.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n\n</urlset>`
    );

    // Push updated sitemap
    const sha = getResp.ok ? (await (await fetch(
      `https://api.github.com/repos/${user}/${repo}/contents/sitemap.xml`,
      { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "HoangEditor" } }
    )).json()).sha : null;

    await fetch(`https://api.github.com/repos/${user}/${repo}/contents/sitemap.xml`, {
      method: "PUT",
      headers: {
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "HoangEditor"
      },
      body: JSON.stringify({
        message: "Update sitemap: " + post.title,
        content: toBase64(sitemap),
        sha: sha || undefined,
        branch: "main"
      })
    });
  }
}
