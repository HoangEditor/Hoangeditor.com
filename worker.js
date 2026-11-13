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

function fromBase64(base64) {
  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
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

        const prompt = `Cinematic wide photograph for a blog. ${topic}. Warm golden hour lighting, luxury real estate interior or exterior, shallow depth of field, professional architectural photography style, 8K quality, photorealistic. No text, no typography, no words, no captions, no logos, no watermarks, clean image only.`;
        const aiResp = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt, steps: 4 });
        let base64;
        if (typeof aiResp === 'string') base64 = aiResp;
        else if (aiResp && typeof aiResp === 'object' && typeof aiResp.image === 'string') base64 = aiResp.image;
        else if (aiResp && aiResp.image) base64 = await new Response(aiResp.image).text();
        else base64 = await new Response(aiResp).text();
        const binaryStr = atob(base64.replace(/^data:image\/\w+;base64,/, ''));
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

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    // Diagnostics endpoint: GET /__diagnostics
    if (url.pathname === "/__diagnostics") {
      const results = {};
      try {
        const gh = await fetchExistingPosts(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO);
        results.github = { ok: true, postsCount: gh.length };
      } catch (e) {
        results.github = { ok: false, error: e.message };
      }
      if (env.DEEPSEEK_KEY) {
        try {
          const dsResp = await fetch("https://api.deepseek.com/models", {
            headers: { Authorization: "Bearer " + env.DEEPSEEK_KEY.trim() }
          });
          results.deepseek = { ok: dsResp.ok, status: dsResp.status };
        } catch (e) {
          results.deepseek = { ok: false, error: e.message };
        }
      } else {
        results.deepseek = { ok: false, reason: "DEEPSEEK_KEY secret not set" };
      }
      try {
        const aiTest = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
          prompt: "Say OK in one word.",
          max_tokens: 5
        });
        results.workersAI = { ok: true, response: (aiTest?.response || "").trim() };
      } catch (e) {
        results.workersAI = { ok: false, error: e.message };
      }
      try {
        await env.BLOG_IMAGES.list({ limit: 1 });
        results.r2 = { ok: true };
      } catch (e) {
        results.r2 = { ok: false, error: e.message };
      }
      return new Response(JSON.stringify(results, null, 2), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // Manual triggers for testing
    if (request.method === "POST" || request.method === "GET") {
      const handlers = {
        "/__trigger": () => runAutoPost(env),
        "/__topics": () => runSmartTopics(env),
        "/__pillar": () => runPillar(env),
        "/__refresh": () => runRefresh(env),
        "/__weekly": () => runWeekly(env)
      };
      if (handlers[url.pathname]) {
        try {
          await handlers[url.pathname]();
          return new Response(JSON.stringify({ success: true, message: "OK — done!" }), {
            status: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }
      }
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    const cron = event.cron || '';
    // Weekly maintenance (Monday 8am): pillar + refresh + smart topics
    if (cron === '0 8 * * 1') {
      ctx.waitUntil(runWeekly(env));
      return;
    }
    // Default: daily auto-post
    ctx.waitUntil(runAutoPost(env));
  }
};

async function runAutoPost(env) {
  try {
    console.log('Auto-post cron triggered at', new Date().toISOString());

    // 1. Pick a random topic from an expanded, high-value pool
    const topics = [
      // Equipment & Camera Gear
      "Best Cameras for Real Estate Videography in 2026: Full Frame vs APS-C",
      "Why 16-35mm Is the Ultimate Lens Range for Property Walkthroughs",
      "Gimbal Balancing Masterclass: Eliminating Footstep Shake in Real Estate Videos",
      "ND Filters for Real Estate Video: How to Maintain 180-Degree Shutter Indoors and Outdoors",
      "Audio Gear for Real Estate Videographers: Best Wireless Mics for Agent Walkthroughs",
      "DJI Ronin vs Zhiyun Crane: Which Gimbal Delivers Smoother Real Estate Footage?",
      "Sony FX3 vs A7S III for Real Estate Videography: Key Differences That Matter",

      // Drone & Aerial Filming
      "FPV Drones for Real Estate: How to Shoot Seamless Indoor-to-Outdoor One-Take Tours",
      "10 Drone Moves Every Real Estate Videographer Must Master for Luxury Listings",
      "How to Smooth Out Jerky Drone Footage in Post-Production",
      "Part 107 Compliance: Safe Flying Rules for Commercial Real Estate Drone Shooters",
      "Orbit vs Reveal: When to Use Which Drone Shot for Maximum Architectural Impact",
      "Golden Hour Drone Shots: Editing Aerial Footage for Luxury Waterfront Properties",
      "High-Wind Drone Filming: Post-Production Stabilization Secrets",

      // Color Grading & Picture Profiles
      "Sony S-Log3 to Rec.709: The Definitive Color Grading Workflow for Real Estate",
      "Fixing Mixed Lighting in Property Videos: Tungsten Interior vs Daylight Windows",
      "How to Achieve Clean Whites and Natural Wall Colors in Real Estate Video Edits",
      "HDR vs SDR for Real Estate Video Delivery: What Platforms Actually Support",
      "Canon C-Log3 vs Sony S-Log3: Color Grading Differences in Architectural Footage",
      "LUTs for Real Estate Videographers: Why Custom Grades Beat Generic Presets",
      "How to Match Colors Across Drone, Camera, and Phone Footage in One Edit",

      // Speed Ramping & Motion Dynamics
      "Speed Ramping Secrets: How to Make 4-Minute Walkthroughs Feel Like 60 Seconds",
      "Whip Pans and Mask Transitions: When to Use Them and When They Look Cheap",
      "Pacing Property Tours: How Cutting on the Beat Keeps Buyers Watching",
      "Smooth Slow-Motion: Choosing 60fps vs 120fps for Luxury Real Estate Highlights",
      "Creating Cinematic Transitions Between Small Bathrooms and Hallways",

      // Lighting & Window Pulls
      "Window Pull Techniques in Video: Balancing Bright Windows with Dark Interiors",
      "Natural Light vs Video Lights: The Fastest Setup for Solo Real Estate Shooters",
      "Day-to-Dusk Video Editing: Transforming Afternoon Footage into a Twilight Masterpiece",
      "Sky Replacement in Real Estate Videos: How to Fix Overcast Skies Without Looking Fake",
      "Shooting Tight Spaces: How to Light Powder Rooms and Closets for Clean Video Edits",

      // Sound Design & Music Selection
      "Sound Design Secrets for Luxury Real Estate: Adding Foley, Room Tone, and Whooshes",
      "How to Choose Royalty-Free Music That Matches the Architecture of the Home",
      "Audio Mixing for Agent Walkthroughs: EQ, Compression, and Background Music Ducking",
      "Removing Air Conditioner and Refrigerator Hum from Real Estate Audio",
      "Voiceover Recording Tips for Real Estate Agents: Getting Studio Quality On-Site",

      // Short-Form & Social Media Formats
      "Editing Vertical 9:16 Real Estate Videos for Instagram Reels and TikTok",
      "The 3-Second Hook Rule: How to Stop the Scroll on Real Estate Social Video",
      "How to Repurpose One Long Property Tour into 5 High-Performing Shorts",
      "Adding Captions and Motion Graphics That Keep Social Media Viewers Engaged",
      "Horizontal vs Vertical: How to Package Video Deliverables for Modern Agents",

      // Agent Personal Branding
      "How to Direct Hesitant Real Estate Agents On Camera for Brand Videos",
      "Editing Agent Bio Videos That Convert Casual Viewers into High-End Listings",
      "Teleprompter Workflows for Real Estate Agents: Shooting Fast Without Forgetting Lines",
      "Layering B-Roll over Talking Heads: Keeping Agent Interviews Visually Dynamic",

      // Business Growth & Scaling
      "How to Price Real Estate Video Packages: Tiered Pricing from Standard to Ultra-Luxury",
      "From Solo Videographer to 5-Figure Monthly Production Studio: The Growth Playbook",
      "The Real Cost of Editing Your Own Footage: Why Outsourcing Unlocks Scaling",
      "Client Retention for Real Estate Videographers: How to Keep Top Agents on Retainer",
      "Fast Turnaround Guarantee: How Delivering Edits in 24 Hours Doubles Your Bookings",
      "How to Write Real Estate Video Contracts That Protect Revisions and Copyright",
      "Handling Scope Creep: What to Do When Agents Ask for Endless Video Revisions",
      "Cold Outreach Scripts That Actually Book Meetings with Top Producing Real Estate Agents",

      // Editing Workflow & Technical Post-Production
      "Premiere Pro vs DaVinci Resolve: Which NLE Is Faster for Real Estate Turnarounds?",
      "Proxy Workflows for Real Estate 4K/6K Footage: Editing Without Timeline Lag",
      "File Organization and Project Templates: Cutting Your Edit Time in Half",
      "Best Export Settings for Real Estate Videos on YouTube, Vimeo, and Instagram",
      "Virtual Staging in Video: What Tools Actually Work for Moving Shots?",
      "How to Add Animated Lower Thirds and Property Spec Highlights Seamlessly"
    ];

    // Fetch existing posts once (for dedup + internal linking)
    const existingPosts = await fetchExistingPosts(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO);
    const existingTitles = existingPosts.map(p => p.title);

    // Merge dynamic topic pool (from weekly smart topics) with built-in topics
    const pool = await fetchTopicPool(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO);
    const allTopics = [...new Set([...pool, ...topics])];

    // Pick a topic that is NOT a duplicate (try up to all available topics)
    let topic = null;
    const shuffled = allTopics.sort(() => 0.5 - Math.random());
    for (const candidate of shuffled) {
      if (!isDuplicate(candidate, existingTitles)) {
        topic = candidate;
        break;
      }
    }

    // Auto-replenish if all topics exhausted
    if (!topic) {
      console.log('All topics exhausted — generating fresh topics on the fly...');
      const freshTopics = await suggestTopics(env);
      for (const candidate of freshTopics) {
        if (!isDuplicate(candidate, existingTitles)) {
          topic = candidate;
          break;
        }
      }
      if (freshTopics.length > 0) {
        await saveTopicsPool(env, freshTopics);
      }
    }

    // Ultimate fallback if still no topic found
    if (!topic) {
      const fallbackAngles = [
        "Workflow Optimization", "Color Grading Strategies", "Pricing and Packaging",
        "Cinematic Camera Movement", "Audio & Sound Design", "Client Retention Tactics",
        "Turnaround Speed Techniques", "High-End Luxury Listing Edits", "Social Media Cutdowns"
      ];
      const randomAngle = fallbackAngles[Math.floor(Math.random() * fallbackAngles.length)];
      topic = `Real Estate Video Editing: Master Guide to ${randomAngle}`;
    }
    console.log('Selected topic:', topic);

    // Internal linking: find related posts
    const relatedPosts = findRelatedPosts(topic, existingPosts, 3);

    // 2. Generate post via DeepSeek or Workers AI fallback
    const post = await generatePost(env, topic);
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
    await deployToGitHub(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO, post, imageUrl, relatedPosts);
    console.log('Deployed to GitHub:', post.title);

    // 5. Update posts-data.js
    await updatePostsData(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO, post);
    console.log('Posts data updated');

    // 6. Update sitemap
    await updateSitemap(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO, post);
    console.log('Sitemap updated');

    // 7. Notify + auto-share (best effort, errors are swallowed)
    const postSlug = post.slug || slugify(post.title);
    const url = `https://hoangeditor.com/blog/posts/${postSlug}.html`;
    await notifyAndShare(env, post, url, imageUrl);

  } catch (e) {
    console.log('Auto-post FAILED:', e.message, e.stack);
    throw e; // Re-throw so caller knows it failed
  }
}

function extractJSON(s) {
  if (!s) return null;
  if (typeof s !== 'string') {
    if (Array.isArray(s)) {
      s = s.map(part => (typeof part === 'string' ? part : part?.text || '')).join('');
    } else if (typeof s === 'object') {
      if (s.title && s.content) return JSON.stringify(s);
      if (typeof s.response === 'string') s = s.response;
      else if (typeof s.text === 'string') s = s.text;
      else {
        try { s = JSON.stringify(s); } catch (e) { return null; }
      }
    } else {
      s = String(s);
    }
  }
  const codeMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = codeMatch ? codeMatch[1] : s;
  const m = candidate.match(/\{[\s\S]*\}/);
  return m ? m[0] : null;
}

async function generatePost(env, topic) {
  const today = new Date().toISOString().split('T')[0];

  const sysPrompt = `You are an expert SEO blog writer for Hoang Editor, a professional real estate video editing service. Our audience: real estate video shooters, videographers, and production teams who want to outsource post-production.

Write a 500-800 word blog post. Use proper HTML: <h2> for sections, <h3> for subsections, <p> for paragraphs, <ul><li> for lists, <blockquote> for quotes, <strong> for emphasis.

Include these keywords naturally: real estate video editing, video post-production, property tour, real estate videographer, outsourced video editing, video editing partner, production team.

End the "content" field with: <div class="post-cta"><h3>Ready to scale your video business?</h3><p>We edit real estate videos so you can focus on shooting.</p><a href="https://hoangeditor.com/#contact" class="cta-btn">Start a Project →</a></div>

Also produce:
1. "faq": 3-4 question/answer pairs (common buyer questions) as [{q, a}] — each answer 1-2 sentences with a keyword.
2. "socialSnippets": 3 short catchy captions (under 200 chars each) for Pinterest/Twitter/LinkedIn promotion.
3. "imagePrompt": a 1-2 sentence English visual description for a blog featured image that is SPECIFIC to this article's subject (not a generic luxury home). Example: for drone → "aerial drone shot of a house"; for color grading → "a video editor adjusting color on a screen"; for speed ramping → "motion blur of a home interior walkthrough"; for client retention → "a videographer shaking hands with a real estate agent". Describe a photorealistic scene, no text/words/watermarks.

Output ONLY valid JSON, no other text:
{"title":"...","description":"120-155 char meta description...","tags":"Tag1, Tag2, Tag3","date":"${today}","readTime":"4 min read","content":"<full HTML body with H2/H3 tags ending in CTA>","faq":[{"q":"...","a":"..."}],"socialSnippets":["...","...","..."],"imagePrompt":"..."}`;

  // 1. Try DeepSeek API if DEEPSEEK_KEY is set
  if (env.DEEPSEEK_KEY && env.DEEPSEEK_KEY.trim()) {
    try {
      console.log('Attempting post generation via DeepSeek API for topic:', topic);
      const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + env.DEEPSEEK_KEY.trim()
        },
        body: JSON.stringify({
          model: "deepseek-v4-pro",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: "Write a blog post about: " + topic }
          ],
          temperature: 0.7,
          max_tokens: 8000,
          response_format: { type: "json_object" }
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.warn(`DeepSeek API error (status ${resp.status}): ${errText}. Falling back to Workers AI.`);
      } else {
        const data = await resp.json();
        const choice = data.choices?.[0] || {};
        const msg = choice.message || {};
        const content = msg.content || '';
        const reasoning = msg.reasoning_content || '';
        const text = content || reasoning || choice.text || '';
        const jsonStr = extractJSON(content) || extractJSON(reasoning) || extractJSON(text);
        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          if (parsed && parsed.title && parsed.content) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn("DeepSeek generation failed:", e.message, ". Falling back to Workers AI.");
    }
  }

  // 2. Fallback to Cloudflare Workers AI (Built-in, zero cost, always available)
  if (env.AI) {
    console.log('Generating post via Cloudflare Workers AI (@cf/meta/llama-3.3-70b-instruct-fp8-fast)...');
    const aiResp = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        { role: "system", content: sysPrompt },
        { role: "user", content: "Write a blog post about: " + topic + ". Output ONLY valid raw JSON." }
      ],
      max_tokens: 4000,
      temperature: 0.7
    });

    const text = aiResp?.response || (typeof aiResp === 'string' ? aiResp : JSON.stringify(aiResp));
    const jsonStr = extractJSON(text);
    if (!jsonStr) {
      throw new Error("Could not parse JSON from Workers AI. Raw: " + text.substring(0, 300));
    }
    const parsed = JSON.parse(jsonStr);
    if (!parsed.title) parsed.title = topic;
    if (!parsed.date) parsed.date = today;
    if (!parsed.readTime) parsed.readTime = '4 min read';
    if (!parsed.tags) parsed.tags = 'Video Editing, Real Estate';
    if (!parsed.content) throw new Error("Workers AI output had empty content field.");
    return parsed;
  }

  throw new Error("No AI provider available. Check DEEPSEEK_KEY or env.AI binding.");
}

async function generateImage(ai, bucket, topic, post) {
  // Build a descriptive prompt for the featured image — use the AI's specific imagePrompt when available
  const base = (post.imagePrompt && post.imagePrompt.length > 5) ? post.imagePrompt : `cinematic real estate video editing theme related to ${topic}`;
  const prompt = `${base}. Professional photorealistic photography, shallow depth of field, warm cinematic lighting, high quality 8K. No text, no typography, no words, no captions, no logos, no watermarks, clean image only.`;

  const inputs = {
    prompt: prompt,
    steps: 4
  };

  const response = await ai.run("@cf/black-forest-labs/flux-1-schnell", inputs);

  // Flux returns { image: base64string } or a base64 string directly
  let base64;
  if (typeof response === 'string') {
    base64 = response;
  } else if (response && typeof response === 'object' && response.image) {
    if (typeof response.image === 'string') {
      base64 = response.image;
    } else {
      // Might still be a stream in some versions
      const text = await new Response(response.image).text();
      base64 = text;
    }
  } else {
    throw new Error("Unexpected AI response format: " + typeof response);
  }

  // Decode base64 to binary
  const binaryStr = atob(base64.replace(/^data:image\/\w+;base64,/, ''));
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

async function deployToGitHub(token, user, repo, post, imageUrl, relatedPosts) {
  let slug = (post.slug || slugify(post.title)).substring(0, 60);

  // Check if file already exists on GitHub to avoid "sha wasn't supplied" error
  let sha = undefined;
  try {
    const checkResp = await fetch(
      `https://api.github.com/repos/${user}/${repo}/contents/blog/posts/${slug}.html`,
      { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "HoangEditor" } }
    );
    if (checkResp.ok) {
      // If slug exists, add date suffix to create a unique new article
      const datePart = (post.date || new Date().toISOString().split('T')[0]).replace(/-/g, '');
      const suffixed = (slug.substring(0, 50) + '-' + datePart).substring(0, 60);
      slug = suffixed;

      // Check if suffixed slug also exists; if so, grab its sha to safely update
      const checkAgain = await fetch(
        `https://api.github.com/repos/${user}/${repo}/contents/blog/posts/${slug}.html`,
        { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "HoangEditor" } }
      );
      if (checkAgain.ok) {
        const existingData = await checkAgain.json();
        sha = existingData.sha;
      }
    }
  } catch (e) {
    console.warn("Slug pre-check error (ignoring):", e.message);
  }

  post.slug = slug; // Keep updated slug on post object
  const html = buildHTML(post, slug, imageUrl, relatedPosts);

  const payload = {
    message: "Auto-publish: " + post.title,
    content: toBase64(html),
    branch: "main"
  };
  if (sha) payload.sha = sha;

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
      body: JSON.stringify(payload)
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    let errMsg = resp.status;
    try { errMsg = JSON.parse(text).message || resp.status; } catch (e) { errMsg = text.substring(0, 200); }
    throw new Error("GitHub deploy failed: " + errMsg);
  }
}

function buildHTML(post, slug, imageUrl, relatedPosts) {
  const d = new Date(post.date + "T00:00:00");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dateStr = months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  const primaryTag = (post.tags || "").split(",")[0].trim() || "General";

  // Build FAQ section + schema
  let faqHtml = '';
  let faqSchema = '';
  if (Array.isArray(post.faq) && post.faq.length > 0) {
    faqHtml = '<section class="post-faq"><h2>Frequently Asked Questions</h2>' +
      post.faq.map(f => `<div class="faq-item"><h3>${(f.q||'').replace(/[<>]/g,'')}</h3><p>${(f.a||'').replace(/[<>]/g,'')}</p></div>`).join('') +
      '</section>';
    faqSchema = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[${post.faq.map(f => `{"@type":"Question","name":"${(f.q||'').replace(/"/g,'\\"')}","acceptedAnswer":{"@type":"Answer","text":"${(f.a||'').replace(/"/g,'\\"')}"}}`).join(',')}]}</script>`;
  }

  // Build related posts section
  let relatedHtml = '';
  if (Array.isArray(relatedPosts) && relatedPosts.length > 0) {
    relatedHtml = '<section class="related-posts"><h2>Related Articles</h2><div class="related-grid">' +
      relatedPosts.map(r => `<a href="${r.slug}.html" class="related-card"><div class="rel-title">${(r.title||'').replace(/[<>]/g,'')}</div></a>`).join('') +
      '</div></section>';
  }

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
${faqSchema}
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

${faqHtml}
${relatedHtml}

<div class="post-author-box">
<div class="author-avatar-lg">HE</div>
<div class="author-bio"><div class="author-name-lg">Hoang Editor Team</div><div class="author-desc">Professional real estate video editing partner for shooters and production teams. We help videographers scale by handling post-production.</div></div>
</div>

<div class="post-cta"><h3>Ready to scale your video business?</h3><p>We edit real estate videos so you can focus on shooting and growing your client base.</p><a href="https://hoangeditor.com/#contact" class="cta-btn"><i class="fas fa-arrow-right"></i> Start a Project</a></div>
</article>

<footer class="blog-footer"><div class="footer-social"><a href="https://www.instagram.com/hoangeditor.re/" target="_blank" rel="noopener" aria-label="Instagram" class="social-link instagram"><i class="fab fa-instagram"></i></a><a href="https://www.linkedin.com/in/hoangeditor/" target="_blank" rel="noopener" aria-label="LinkedIn" class="social-link linkedin"><i class="fab fa-linkedin-in"></i></a></div><p>&copy; ${d.getFullYear()} Hoang Editor Blog. <a href="https://hoangeditor.com" style="color:var(--gold-400);text-decoration:none">hoangeditor.com</a></p></footer>

<script>
(function(){var tt=document.getElementById("theme-toggle");if(tt){var h=document.documentElement,ti=tt.querySelector("i");if(localStorage.getItem("theme")==="dark"){h.setAttribute("data-theme","dark");ti.className="fas fa-sun"}tt.onclick=function(){var d=h.getAttribute("data-theme")==="dark";if(d){h.removeAttribute("data-theme");ti.className="fas fa-moon";localStorage.setItem("theme","light")}else{h.setAttribute("data-theme","dark");ti.className="fas fa-sun";localStorage.setItem("theme","dark")}}}var hd=document.querySelector(".site-header");if(hd)window.addEventListener("scroll",function(){hd.classList.toggle("scrolled",window.scrollY>40)},{passive:!0});var tg=document.querySelector(".menu-toggle"),mn=document.querySelector(".mobile-menu");if(tg&&mn){var op=!1;tg.addEventListener("click",function(){op=!op;mn.classList.toggle("open",op);tg.innerHTML=op?'<i class="fas fa-times"></i>':'<i class="fas fa-bars"></i>';document.body.style.overflow=op?"hidden":""});mn.querySelectorAll("a").forEach(function(l){l.addEventListener("click",function(){op=!1;mn.classList.remove("open");tg.innerHTML='<i class="fas fa-bars"></i>';document.body.style.overflow=""})})}})();
</script>
</body>
</html>`;
}

function keywordsOf(text) {
  const stopwords = new Set([
    'how','to','for','the','a','an','and','or','of','in','on','that','your','with',
    'without','what','why','from','vs','guide','tips','is','are','this','these','those',
    'which','their','his','her','its','into','about','over','after'
  ]);
  return (text || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
}

function normalizeStr(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isDuplicate(topic, existingTitles) {
  const normTopic = normalizeStr(topic);
  if (!normTopic) return true;

  for (const title of existingTitles) {
    const normTitle = normalizeStr(title);
    if (!normTitle) continue;
    if (normTopic === normTitle) return true;
    if (normTopic.includes(normTitle) || normTitle.includes(normTopic)) {
      const minLen = Math.min(normTopic.length, normTitle.length);
      const maxLen = Math.max(normTopic.length, normTitle.length);
      if (minLen / maxLen >= 0.75) return true;
    }
  }

  const topicWords = keywordsOf(topic);
  if (topicWords.length === 0) return true;
  for (const title of existingTitles) {
    const titleWords = keywordsOf(title);
    if (titleWords.length === 0) continue;
    let overlap = 0;
    for (const w of topicWords) {
      if (titleWords.includes(w)) overlap++;
    }
    const ratio = overlap / Math.min(topicWords.length, titleWords.length);
    if (ratio >= 0.6) return true;
  }
  return false;
}

async function fetchExistingTitles(token, user, repo) {
  const posts = await fetchExistingPosts(token, user, repo);
  return posts.map(p => p.title);
}

async function fetchExistingPosts(token, user, repo) {
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${user}/${repo}/contents/blog/posts-data.js`,
      { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "HoangEditor" } }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const content = fromBase64(data.content);
    const posts = [];
    // Parse entries: match { slug: "...", title: "..." } blocks
    const re = /slug:\s*"([^"]+)"[\s\S]*?title:\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      if (m[1] && m[2]) posts.push({ slug: m[1], title: m[2] });
    }
    return posts;
  } catch (e) {
    return [];
  }
}

async function fetchTopicPool(token, user, repo) {
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${user}/${repo}/contents/blog/topics-pool.json`,
      { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "HoangEditor" } }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const content = JSON.parse(fromBase64(data.content));
    return Array.isArray(content.topics) ? content.topics : [];
  } catch (e) {
    return [];
  }
}

// Find related posts by keyword overlap for internal linking
function findRelatedPosts(currentTopic, allPosts, limit) {
  limit = limit || 3;
  const topicWords = keywordsOf(currentTopic);
  if (topicWords.length === 0 || allPosts.length === 0) return [];
  return allPosts
    .map(p => {
      const pWords = keywordsOf(p.title);
      let overlap = 0;
      for (const w of topicWords) if (pWords.includes(w)) overlap++;
      return { ...p, score: overlap };
    })
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function categorizePost(title, tags) {
  const t = ((title || '') + ' ' + (tags || '')).toLowerCase();
  if (t.includes('drone') || t.includes('aerial')) return 'Drone & Aerial';
  if (t.includes('outsourc')) return 'Outsourcing';
  if (/seo|social media|trends|ai tool|branding|stand out|youtube|instagram|tiktok|google/.test(t)) return 'Marketing & SEO';
  if (/scale|6-figure|business|retention|pric|profit|turnaround|solo shooter|production company|growth/.test(t)) return 'Business Growth';
  if (/lighting|photography/.test(t)) return 'Filming & Production';
  return 'Video Editing';
}

async function updatePostsData(token, user, repo, post) {
  const slug = post.slug || post.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 60);
  const entry = `  {
    slug: "${slug}",
    title: "${post.title.replace(/"/g, '\\"')}",
    description: "${(post.description || '').replace(/"/g, '\\"')}",
    date: "${post.date}",
    readTime: "${post.readTime || '4 min read'}",
    category: "${categorizePost(post.title, post.tags)}",
    icon: "fa-file-lines"
  },\n`;

  // Fetch current posts-data.js
  const getResp = await fetch(
    `https://api.github.com/repos/${user}/${repo}/contents/blog/posts-data.js`,
    { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "User-Agent": "HoangEditor" } }
  );
  if (!getResp.ok) { console.log('Could not fetch posts-data.js'); return; }

  const data = await getResp.json();
  const current = fromBase64(data.content);

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

function slugify(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 60);
}

// ===== NOTIFICATION & SOCIAL SHARING =====

async function notifyAndShare(env, post, url, imageUrl) {
  const results = [];
  // Discord / Slack webhooks
  if (env.DISCORD_WEBHOOK) {
    results.push(notifyDiscord(env.DISCORD_WEBHOOK, post, url));
  }
  if (env.SLACK_WEBHOOK) {
    results.push(notifySlack(env.SLACK_WEBHOOK, post, url));
  }
  // Pinterest
  if (env.PINTEREST_TOKEN && env.PINTEREST_BOARD_ID) {
    results.push(postToPinterest(env.PINTEREST_TOKEN, env.PINTEREST_BOARD_ID, post, url, imageUrl));
  }
  // LinkedIn
  if (env.LINKEDIN_TOKEN && env.LINKEDIN_URN) {
    results.push(postToLinkedIn(env.LINKEDIN_TOKEN, env.LINKEDIN_URN, post, url));
  }
  await Promise.allSettled(results.map(p => p.catch(e => console.log('Share failed:', e.message))));
}

async function notifyDiscord(webhookUrl, post, url) {
  const msg = {
    embeds: [{
      title: post.title,
      description: (post.description || '').substring(0, 200),
      url: url,
      color: 0xf59e0b,
      fields: [
        { name: "Tags", value: (post.tags || 'General').split(',').slice(0,3).join(', '), inline: true },
        { name: "Read time", value: post.readTime || '4 min read', inline: true }
      ]
    }]
  };
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg)
  });
  console.log('Discord notified');
}

async function notifySlack(webhookUrl, post, url) {
  const text = `*New blog post published:* <${url}|${post.title}>\n> ${(post.description || '').substring(0, 150)}`;
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  console.log('Slack notified');
}

async function postToPinterest(token, boardId, post, url, imageUrl) {
  const body = {
    board_id: boardId,
    title: post.title,
    description: (post.socialSnippets && post.socialSnippets[0]) || post.description || '',
    link: url,
    media_source: { source_type: "image_url", url: imageUrl || "https://hoangeditor.com/Hoangeditor.PNG" }
  };
  const resp = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error("Pinterest error: " + resp.status);
  console.log('Pinterest pinned');
}

async function postToLinkedIn(token, authorUrn, post, url) {
  const text = (post.socialSnippets && post.socialSnippets[1]) || post.title;
  const body = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: text + " " + url },
        shareMediaCategory: "ARTICLE",
        media: [{ status: "READY", originalUrl: url }]
      }
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
  };
  const resp = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0" },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error("LinkedIn error: " + resp.status);
  console.log('LinkedIn posted');
}

// ===== WEEKLY TASKS =====

async function runWeekly(env) {
  try {
    await runSmartTopics(env);
  } catch (e) { console.log('Smart topics failed:', e.message); }
  try {
    await runRefresh(env);
  } catch (e) { console.log('Refresh failed:', e.message); }
  try {
    await runPillar(env);
  } catch (e) { console.log('Pillar failed:', e.message); }
}

async function runSmartTopics(env) {
  const topics = await suggestTopics(env);
  if (!topics || topics.length === 0) { console.log('No topics suggested'); return; }
  await saveTopicsPool(env, topics);
}

async function saveTopicsPool(env, topics) {
  try {
    const content = JSON.stringify({ generated: new Date().toISOString(), topics }, null, 2);
    const path = 'blog/topics-pool.json';
    const getResp = await fetch(`https://api.github.com/repos/${env.GITHUB_USER}/${env.GITHUB_REPO}/contents/${path}`, {
      headers: { Authorization: "Bearer " + env.GITHUB_TOKEN, Accept: "application/vnd.github+json", "User-Agent": "HoangEditor" }
    });
    const sha = getResp.ok ? (await getResp.json()).sha : undefined;
    const resp = await fetch(`https://api.github.com/repos/${env.GITHUB_USER}/${env.GITHUB_REPO}/contents/${path}`, {
      method: "PUT",
      headers: { Authorization: "Bearer " + env.GITHUB_TOKEN, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "HoangEditor" },
      body: JSON.stringify({ message: "Update topics pool", content: toBase64(content), sha, branch: "main" })
    });
    console.log('Topics pool updated:', resp.status);
  } catch (e) {
    console.warn('saveTopicsPool failed:', e.message);
  }
}

async function suggestTopics(env) {
  const sys = 'You are a real estate video editing content strategist. Suggest 10 fresh, non-duplicate blog topics for Hoang Editor (real estate video editing service for videographers and production teams). Topics must be specific and SEO-friendly. Output ONLY a JSON array of strings, no other text.';

  if (env.DEEPSEEK_KEY && env.DEEPSEEK_KEY.trim()) {
    try {
      const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.DEEPSEEK_KEY.trim() },
        body: JSON.stringify({ model: "deepseek-v4-pro", messages: [{ role: "system", content: sys }, { role: "user", content: "Suggest 10 new blog topics." }], temperature: 0.8, max_tokens: 1000 })
      });
      if (resp.ok) {
        const data = await resp.json();
        let text = data.choices?.[0]?.message?.content || '';
        if (typeof text !== 'string') text = JSON.stringify(text);
        const match = text.match(/\[[\s\S]*\]/);
        if (match) return JSON.parse(match[0]);
      }
    } catch (e) {
      console.warn("DeepSeek suggestTopics failed:", e.message);
    }
  }

  if (env.AI) {
    try {
      const resp = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: sys },
          { role: "user", content: "Suggest 10 new blog topics as a JSON array." }
        ],
        max_tokens: 1000,
        temperature: 0.8
      });
      let text = resp?.response || '';
      if (typeof text !== 'string') text = JSON.stringify(text);
      const match = text.match(/\[[\s\S]*\]/);
      if (match) return JSON.parse(match[0]);
    } catch (e) {
      console.warn("Workers AI suggestTopics failed:", e.message);
    }
  }

  return [];
}

async function runRefresh(env) {
  // Refresh the oldest post: regenerate content with an updated angle
  const posts = await fetchExistingPosts(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO);
  if (posts.length === 0) return;
  const oldest = posts[posts.length - 1]; // posts-data.js is sorted newest first
  console.log('Refreshing oldest post:', oldest.title);
  const refreshed = await generatePost(env, "Updated guide: " + oldest.title);
  const slug = oldest.slug;
  const html = buildHTML(refreshed, slug, null, findRelatedPosts(oldest.title, posts, 3));
  const getResp = await fetch(`https://api.github.com/repos/${env.GITHUB_USER}/${env.GITHUB_REPO}/contents/blog/posts/${slug}.html`, {
    headers: { Authorization: "Bearer " + env.GITHUB_TOKEN, Accept: "application/vnd.github+json", "User-Agent": "HoangEditor" }
  });
  if (!getResp.ok) { console.log('Could not fetch old post to refresh'); return; }
  const data = await getResp.json();
  await fetch(`https://api.github.com/repos/${env.GITHUB_USER}/${env.GITHUB_REPO}/contents/blog/posts/${slug}.html`, {
    method: "PUT",
    headers: { Authorization: "Bearer " + env.GITHUB_TOKEN, Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "HoangEditor" },
    body: JSON.stringify({ message: "Refresh post: " + refreshed.title, content: toBase64(html), sha: data.sha, branch: "main" })
  });
  console.log('Refreshed:', refreshed.title);
}

async function runPillar(env) {
  const posts = await fetchExistingPosts(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO);
  if (posts.length === 0) return;
  const topic = "The Complete Guide to Real Estate Video Editing (Ultimate Resource)";
  const post = await generatePost(env, topic);
  // Add internal links to top posts inside the pillar content
  const links = posts.slice(0, 8).map(p => `<li><a href="${p.slug}.html">${p.title}</a></li>`).join('');
  post.content = (post.content || '') + `<h2>Explore More</h2><ul>${links}</ul>`;
  await deployToGitHub(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO, post, null, posts.slice(0, 3));
  await updatePostsData(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO, post);
  await updateSitemap(env.GITHUB_TOKEN, env.GITHUB_USER, env.GITHUB_REPO, post);
  console.log('Pillar post published:', post.title);
}

async function updateSitemap(token, user, repo, post) {
  const slug = post.slug || post.title
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
    sitemap = fromBase64(data.content);
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
