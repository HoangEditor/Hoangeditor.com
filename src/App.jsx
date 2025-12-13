import React, { useState, useEffect } from 'react';
import { Play, Check, Mail, Instagram, Facebook, Youtube, Menu, X, ArrowRight, Video, Clock, TrendingUp, Smartphone, Home, MapPin, Zap, Star, Globe, Film, Edit3 } from 'lucide-react';

// Custom TikTok Icon
const TiktokIcon = ({ size = 24, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

const App = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    setIsMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-white">
      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-md shadow-lg border-b border-slate-800' : 'bg-transparent'}`}>
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent cursor-pointer" onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
              HOANGEDITOR
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex space-x-8 items-center">
              {['Portfolio', 'Services', 'Pricing', 'Process'].map((item) => (
                <button 
                  key={item}
                  onClick={() => scrollToSection(item.toLowerCase())}
                  className="text-slate-300 hover:text-amber-400 transition-colors font-medium"
                >
                  {item}
                </button>
              ))}
              <button 
                onClick={() => scrollToSection('contact')}
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-full font-semibold transition-all transform hover:scale-105 shadow-lg shadow-amber-500/30"
              >
                Partner With Me
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button className="md:hidden text-white" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Content */}
        {isMenuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-slate-800 absolute w-full p-6 flex flex-col space-y-4 shadow-2xl">
             {['Portfolio', 'Services', 'Pricing', 'Contact'].map((item) => (
                <button 
                  key={item}
                  onClick={() => scrollToSection(item.toLowerCase())}
                  className="text-left text-lg font-medium text-slate-300 hover:text-amber-400"
                >
                  {item}
                </button>
              ))}
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-600/20 rounded-full blur-[120px] -z-10"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-orange-600/10 rounded-full blur-[100px] -z-10"></div>

        <div className="container mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-700 text-amber-400 text-sm font-semibold mb-8 animate-fade-in-up">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
            Accepting New Partners
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
            You Focus On Shooting <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-200 bg-clip-text text-transparent">
              We Handle The Post
            </span>
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Stop being stuck behind a computer editing all night. I partner with Real Estate Videographers to deliver high-converting edits so you can scale your business.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              onClick={() => scrollToSection('portfolio')}
              className="px-8 py-4 bg-white text-slate-900 rounded-full font-bold text-lg hover:bg-slate-200 transition-all flex items-center gap-2"
            >
              <Play size={20} fill="currentColor" /> View Quality
            </button>
            <button 
              onClick={() => scrollToSection('contact')}
              className="px-8 py-4 bg-slate-800 border border-slate-700 text-white rounded-full font-bold text-lg hover:bg-slate-700 transition-all"
            >
              Let's Connect
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20 border-t border-slate-800 pt-10 max-w-4xl mx-auto">
            {[
              { num: '3+', label: 'Years Experience' },
              { num: '50+', label: 'Videographer Partners' },
              { num: '24h', label: 'Fast Turnaround' },
              { num: '100%', label: 'On-Time Delivery' },
            ].map((stat, idx) => (
              <div key={idx}>
                <div className="text-3xl font-bold text-white mb-1">{stat.num}</div>
                <div className="text-slate-500 text-sm font-medium uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Services</h2>
            <p className="text-slate-400">Comprehensive post-production solutions for Media Teams</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Smartphone size={40} className="text-amber-500" />,
                title: "Vertical Reels & Shorts",
                desc: "High-retention editing for Instagram & TikTok. We turn your raw footage into viral-ready content with trending audio and dynamic captions.",
                features: ["Trend Research", "Kinetic Typography", "Quick Cuts", "Viral Hooks"]
              },
              {
                icon: <Home size={40} className="text-orange-500" />,
                title: "Cinematic Home Tours",
                desc: "Full horizontal edits for YouTube & MLS. Advanced color grading, sound design, and smooth transitions to showcase the property's best features.",
                features: ["4K/60fps Export", "Sound Design", "Speed Ramping", "Agent Branding"]
              },
              {
                icon: <Globe size={40} className="text-yellow-500" />,
                title: "White-Label Editing",
                desc: "We work as your silent backend partner. Seamlessly integrate with your team's workflow while maintaining your unique style.",
                features: ["Drone / FPV Polish", "Location Map Graphics", "Stabilization", "Confidentiality"]
              }
            ].map((service, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800 p-8 rounded-2xl hover:border-amber-500/50 transition-all hover:shadow-2xl hover:shadow-amber-500/10 group">
                <div className="mb-6 p-4 bg-slate-900 w-fit rounded-xl group-hover:scale-110 transition-transform">
                  {service.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{service.title}</h3>
                <p className="text-slate-400 mb-6 leading-relaxed">{service.desc}</p>
                <ul className="space-y-3">
                  {service.features.map((feat, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-300">
                      <Check size={16} className="text-green-500" /> {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio Section */}
      <section id="portfolio" className="py-20">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Featured Projects</h2>
              <p className="text-slate-400">Diverse editing styles to match your brand identity</p>
            </div>
            <button className="text-amber-400 font-semibold hover:text-amber-300 flex items-center gap-2">
              View All on Drive <ArrowRight size={18} />
            </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Real Estate Project Placeholders */}
            {[
              { title: "Modern Villa in LA", type: "Luxury Home Tour" },
              { title: "NYC Penthouse", type: "Instagram Reel" },
              { title: "Miami Beach Condo", type: "Walkthrough" },
              { title: "Texas Ranch Estate", type: "Drone & Map Highlight" },
              { title: "Seattle Family Home", type: "Open House Teaser" },
              { title: "Chicago Loft", type: "Vertical Tour" }
            ].map((item, idx) => (
              <div key={idx} className="group relative aspect-video bg-slate-800 rounded-xl overflow-hidden cursor-pointer">
                {/* Simulated Thumbnail */}
                <div className={`w-full h-full bg-gradient-to-br from-slate-800 to-slate-700 group-hover:scale-105 transition-transform duration-500 flex items-center justify-center`}>
                   <Home size={48} className="text-slate-600" />
                </div>
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 text-center">
                  <div className="bg-amber-600 p-3 rounded-full mb-3 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <Play size={24} fill="white" />
                  </div>
                  <h4 className="text-lg font-bold translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                    {item.title}
                  </h4>
                  <p className="text-sm text-slate-300 mt-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-100">
                    {item.type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - UPDATED TO 3 TIERS */}
      <section id="pricing" className="py-20 bg-slate-900/30 border-y border-slate-800">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Packages</h2>
            <p className="text-slate-400">Competitive rates designed to maximize your profit margin</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* BASIC */}
            <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 hover:border-slate-600 transition-colors flex flex-col">
              <div className="text-slate-400 font-medium mb-2 uppercase tracking-wide text-sm">Essentials</div>
              <div className="text-3xl font-bold mb-2 text-white">Basic</div>
              <p className="text-slate-500 text-sm mb-6 h-10">Perfect for quick teasers and simple social content.</p>
              
              <div className="text-2xl font-bold mb-6 text-amber-500">Contact for Quote</div>

              <div className="space-y-4 mb-8 flex-grow">
                <div className="text-sm font-semibold text-white border-b border-slate-800 pb-2 mb-2">Includes:</div>
                <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-green-500 mt-0.5 shrink-0"/> Under 60 seconds duration</li>
                <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-green-500 mt-0.5 shrink-0"/> Horizontal & Vertical delivery</li>
                <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-green-500 mt-0.5 shrink-0"/> Trending Audio Selection</li>
                <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-green-500 mt-0.5 shrink-0"/> Basic Color & Transitions</li>
                
                <div className="text-sm font-semibold text-white border-b border-slate-800 pb-2 mt-4 mb-2">Does NOT Include:</div>
                <li className="flex items-center gap-3 text-slate-500 text-sm"><X size={16} className="shrink-0"/> Text Animations</li>
                <li className="flex items-center gap-3 text-slate-500 text-sm"><X size={16} className="shrink-0"/> 3D Motion Tracking</li>
                <li className="flex items-center gap-3 text-slate-500 text-sm"><X size={16} className="shrink-0"/> AI Effects</li>
              </div>
              <button onClick={() => scrollToSection('contact')} className="w-full py-3 rounded-xl border border-slate-700 text-white font-semibold hover:bg-slate-800 transition-colors">
                Select Basic
              </button>
            </div>

            {/* ADVANCED - Highlighted */}
            <div className="bg-slate-900 p-8 rounded-2xl border-2 border-amber-500 relative transform md:-translate-y-4 shadow-2xl shadow-amber-900/20 flex flex-col">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                Most Popular
              </div>
              <div className="text-amber-400 font-medium mb-2 uppercase tracking-wide text-sm">Professional</div>
              <div className="text-3xl font-bold mb-2 text-white">Advanced</div>
              <p className="text-slate-400 text-sm mb-6 h-10">Maximize engagement with dynamic edits & tracking.</p>
              
              <div className="text-2xl font-bold mb-6 text-amber-400">Contact for Quote</div>

              <div className="space-y-4 mb-8 flex-grow">
                <div className="text-sm font-semibold text-white border-b border-slate-700 pb-2 mb-2">Everything in Basic, plus:</div>
                <li className="flex items-start gap-3 text-white text-sm"><Check size={16} className="text-amber-400 mt-0.5 shrink-0"/> <strong>Upbeat Editing</strong> (Sync to beat)</li>
                <li className="flex items-start gap-3 text-white text-sm"><Check size={16} className="text-amber-400 mt-0.5 shrink-0"/> <strong>Kinetic Text Animation</strong></li>
                <li className="flex items-start gap-3 text-white text-sm"><Check size={16} className="text-amber-400 mt-0.5 shrink-0"/> <strong>3D Motion Tracking</strong></li>
                <li className="flex items-start gap-3 text-white text-sm"><Check size={16} className="text-amber-400 mt-0.5 shrink-0"/> Call-outs & Graphics</li>
                
                <div className="text-sm font-semibold text-white border-b border-slate-700 pb-2 mt-4 mb-2">Does NOT Include:</div>
                <li className="flex items-center gap-3 text-slate-500 text-sm"><X size={16} className="shrink-0"/> AI Visual Effects</li>
              </div>
              <button onClick={() => scrollToSection('contact')} className="w-full py-3 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/30">
                Select Advanced
              </button>
            </div>

            {/* PREMIUM */}
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 hover:border-slate-600 transition-colors flex flex-col">
              <div className="text-slate-400 font-medium mb-2 uppercase tracking-wide text-sm">Luxury</div>
              <div className="text-3xl font-bold mb-2 text-white">Premium</div>
              <p className="text-slate-500 text-sm mb-6 h-10">Production-house quality for high-end listings.</p>
              
              <div className="text-2xl font-bold mb-6 text-amber-500">Contact for Quote</div>

              <div className="space-y-4 mb-8 flex-grow">
                <div className="text-sm font-semibold text-white border-b border-slate-800 pb-2 mb-2">Everything in Advanced, plus:</div>
                <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-amber-500 mt-0.5 shrink-0"/> <strong>AI Visual Effects</strong></li>
                <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-amber-500 mt-0.5 shrink-0"/> Sky Replacement</li>
                <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-amber-500 mt-0.5 shrink-0"/> Object Removal / Cleanup</li>
                <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-amber-500 mt-0.5 shrink-0"/> AI Voice-overs (if needed)</li>
                <li className="flex items-start gap-3 text-slate-300 text-sm"><Check size={16} className="text-amber-500 mt-0.5 shrink-0"/> Unlimited Revisions</li>
              </div>
              <button onClick={() => scrollToSection('contact')} className="w-full py-3 rounded-xl border border-amber-500 text-amber-400 font-semibold hover:bg-amber-500/10 transition-colors">
                Select Premium
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section - UPDATED */}
      <section id="process" className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Workflow</h2>
            <p className="text-slate-400">Streamlined process to keep your delivery schedule on track</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { icon: <Mail />, title: "1. Upload Footage", desc: "Share your raw files via Google Drive, Dropbox, or WeTransfer." },
              { icon: <Edit3 />, title: "2. Specific Request", desc: "Detail your preferred style, music choice, or provide reference links." },
              { icon: <Check />, title: "3. Delivery", desc: "Receive the high-quality 4K export ready for client review." },
              { icon: <TrendingUp />, title: "4. Feedback & Revisions", desc: "Request adjustments until the video meets your exact standards." },
            ].map((step, idx) => (
              <div key={idx} className="relative text-center">
                {idx !== 3 && <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-slate-800 -z-10"></div>}
                <div className="w-16 h-16 mx-auto bg-slate-900 border border-slate-700 rounded-full flex items-center justify-center text-amber-400 mb-6 shadow-lg">
                  {step.icon}
                </div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-slate-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA / Footer */}
      <footer id="contact" className="bg-slate-950 border-t border-slate-800 pt-20 pb-10">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-12 mb-16">
            <div>
              <h2 className="text-4xl font-bold mb-6">Need a Reliable Post-Production Partner?</h2>
              <p className="text-slate-400 text-lg mb-8">
                Let me handle the backend work. We build a long-term partnership so you can focus on shooting and growing your revenue.
              </p>
              <div className="flex flex-col gap-4">
                <a href="mailto:contact@hoangeditor.com" className="flex items-center gap-4 p-4 bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors border border-slate-800">
                  <div className="bg-amber-600/20 p-3 rounded-full text-amber-400">
                    <Mail size={24} />
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Email</div>
                    <div className="font-semibold text-lg">contact@hoangeditor.com</div>
                  </div>
                </a>
                
                <a href="#" className="flex items-center gap-4 p-4 bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors border border-slate-800">
                  <div className="bg-pink-600/20 p-3 rounded-full text-pink-400">
                    <Instagram size={24} />
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">Instagram</div>
                    <div className="font-semibold text-lg">@hoang.editor.re</div>
                  </div>
                </a>

                {/* Added YouTube */}
                <a href="#" className="flex items-center gap-4 p-4 bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors border border-slate-800">
                  <div className="bg-red-600/20 p-3 rounded-full text-red-400">
                    <Youtube size={24} />
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">YouTube</div>
                    <div className="font-semibold text-lg">HoangEditor Channel</div>
                  </div>
                </a>

                {/* Added TikTok */}
                <a href="#" className="flex items-center gap-4 p-4 bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors border border-slate-800">
                   <div className="bg-slate-700/50 p-3 rounded-full text-white">
                    <TiktokIcon size={24} />
                  </div>
                  <div>
                    <div className="text-sm text-slate-400">TikTok</div>
                    <div className="font-semibold text-lg">@hoang.editor.official</div>
                  </div>
                </a>
              </div>
            </div>

            {/* Simple Contact Form */}
            <form className="bg-slate-900 p-8 rounded-2xl border border-slate-800">
              <h3 className="text-xl font-bold mb-6">Let's Work Together</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Name / Media Agency</label>
                  <input type="text" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500 text-white" placeholder="John Doe (Freelancer/Agency)" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Email / WhatsApp</label>
                  <input type="text" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500 text-white" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Current Need</label>
                  <select className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500 text-white">
                    <option>Urgent Single Project</option>
                    <option>Long-term Partnership</option>
                    <option>Requesting Quote</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Message</label>
                  <textarea rows="4" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500 text-white" placeholder="I have a batch of home tours needing edits..."></textarea>
                </div>
                <button className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold py-4 rounded-lg hover:opacity-90 transition-opacity">
                  Send Inquiry
                </button>
              </div>
            </form>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
            <div>© 2024 HoangEditor. Real Estate Post-Production Partner.</div>
            <div className="flex gap-6 items-center">
              <a href="#" className="hover:text-white transition-colors"><Facebook size={20}/></a>
              <a href="#" className="hover:text-white transition-colors"><Instagram size={20}/></a>
              <a href="#" className="hover:text-white transition-colors"><Youtube size={20}/></a>
              <a href="#" className="hover:text-white transition-colors"><TiktokIcon size={20}/></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;