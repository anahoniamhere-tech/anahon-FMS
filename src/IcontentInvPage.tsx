import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Copy, Download, ExternalLink, Eye, Grid, List, Search, Share2 } from "lucide-react";

// ==========================================
// PUBLIC CONTENT INVENTORY PAGE (/Icontent_Inv)
// ==========================================
export default function IcontentInvPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeModalImage, setActiveModalImage] = useState<any | null>(null);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const images = [
    {
      id: "hon_logo",
      title: "HON - Roots and Reach Logo Poster",
      description: "Official branding and visual identity poster for HON: 'Roots and Reach - Here We Are'. High contrast graphic on warm yellow background.",
      url: "/assets/images/hon_logo.jpg",
      size: "46.3 KB",
      type: "JPEG Image",
      dimensions: "768 × 1024 px",
    },
    {
      id: "tripoli_arch",
      title: "Al-Mina Traditional Souk Arches",
      description: "Atmospheric view of the historical stone-vaulted corridors and traditional marketplaces of Tripoli, Lebanon.",
      url: "/assets/images/tripoli_arch.png",
      size: "235 KB",
      type: "PNG Image",
      dimensions: "640 × 960 px",
    },
    {
      id: "concrete_pavilion",
      title: "Niemeyer Concrete Arched Pavilion",
      description: "The modernist architectural curves of the Rashid Karami International Fairground in Tripoli, designed by Oscar Niemeyer.",
      url: "/assets/images/concrete_pavilion.jpg",
      size: "223 KB",
      type: "JPEG Image",
      dimensions: "1024 × 683 px",
    },
    {
      id: "man_portrait",
      title: "AnaHon Portrait Archive",
      description: "Professional staff portrait of a smiling member of the AnaHon team, taken against the backdrop of the Tripoli hills.",
      url: "/assets/images/man_portrait.jpg",
      size: "213 KB",
      type: "JPEG Image",
      dimensions: "1024 × 1024 px",
    },
    {
      id: "exhibition_hall",
      title: "Tripoli Explained Exhibition",
      description: "An interactive educational exhibition organized inside Niemeyer's pavilion, titled 'Tripoli Explained: An Interactive Journey'.",
      url: "/assets/images/exhibition_hall.jpg",
      size: "360 KB",
      type: "JPEG Image",
      dimensions: "1024 × 576 px",
    },
    {
      id: "hon_banner",
      title: "HON - Horizontal Logo Banner",
      description: "Official horizontal logotype and brand mark for HON: 'Roots and Reach - Here We Are'. High-resolution black and white branding banner.",
      url: "/assets/images/hon_banner.png",
      size: "71.4 KB",
      type: "PNG Image",
      dimensions: "1024 × 534 px",
    },
    {
      id: "tripoli_hammam",
      title: "Hammam Ezzeddine Bathhouse Interior",
      description: "The historical stone domes, vaulted archways, and central octagonal marble fountain inside Tripoli's Hammam Ezzeddine.",
      url: "/assets/images/tripoli_hammam.jpg",
      size: "76.2 KB",
      type: "JPEG Image",
      dimensions: "502 × 336 px",
    },
    {
      id: "hon_banner_yellow",
      title: "HON - Horizontal Yellow Logo Banner",
      description: "Official horizontal logotype and brand mark for HON: 'Roots and Reach - Here We Are'. Elegant yellow-themed brand identity banner.",
      url: "/assets/images/hon_banner_yellow.png",
      size: "85.3 KB",
      type: "PNG Image",
      dimensions: "1024 × 534 px",
    }
  ];

  const filteredImages = images.filter(img =>
    img.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    img.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setShareToast(`Downloading ${filename}...`);
    setTimeout(() => setShareToast(null), 3000);
  };

  const handleCopyLink = (url: string, id: string) => {
    const absUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(absUrl).then(() => {
      setCopiedId(id);
      setShareToast("Direct link copied to clipboard!");
      setTimeout(() => {
        setCopiedId(null);
        setShareToast(null);
      }, 3000);
    }).catch(() => {
      setShareToast("Failed to copy link");
      setTimeout(() => setShareToast(null), 3000);
    });
  };

  const handleShare = (img: any) => {
    if (navigator.share) {
      navigator.share({
        title: img.title,
        text: img.description,
        url: `${window.location.origin}${img.url}`
      }).catch(() => {});
    } else {
      handleCopyLink(img.url, img.id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] start-[-10%] w-[50%] h-[50%] rounded-full bg-red-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] end-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />

      {/* Elegant Header */}
      <header className="sticky top-0 z-40 bg-slate-900/75 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-lg shadow-md hover:bg-red-500 transition-colors">
              AH
            </a>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                AnaHon Content Inventory
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">Public Access</span>
              </h1>
              <p className="text-xs text-slate-400 font-mono">Archive extension: /Icontent_Inv</p>
            </div>
          </div>
          
          <a href="/" className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all shadow-sm">
            <ArrowLeft size={14} className="rtl:rotate-180" />
            Back to Portal
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        
        {/* Intro section */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-900 pb-8">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-3xl font-extrabold text-white tracking-tight">Tripoli Visual Archives</h2>
            <p className="text-sm text-slate-400">
              A curated collection of media assets showcasing the cultural, historical, and architectural identity of Tripoli, Lebanon. These verified resources are publicly available for editorial, programmatic, and compliance documentation use.
            </p>
          </div>
          
          {/* Quick Stats */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/50 backdrop-blur border border-slate-850 rounded-xl p-3">
            <div className="text-center px-4 border-e border-slate-800">
              <span className="block text-xs text-slate-500 font-mono uppercase">Total Files</span>
              <span className="text-xl font-bold text-white">5</span>
            </div>
            <div className="text-center px-4 border-e border-slate-800">
              <span className="block text-xs text-slate-500 font-mono uppercase">Archive Size</span>
              <span className="text-xl font-bold text-red-500">1.08 MB</span>
            </div>
            <div className="text-center px-4">
              <span className="block text-xs text-slate-500 font-mono uppercase">Availability</span>
              <span className="text-xl font-bold text-emerald-500">100%</span>
            </div>
          </div>
        </div>

        {/* Toolbar: Search and View Mode */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
          {/* Search */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search images or descriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full ps-10 pe-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-650 transition-all font-sans"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-350"}`}
              title="Grid View"
              style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-slate-800 text-white" : "text-slate-500 hover:text-slate-350"}`}
              title="List View"
              style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {/* Empty state */}
        {filteredImages.length === 0 && (
          <div className="text-center py-20 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl">
            <p className="text-slate-500 text-sm">No assets match your search terms.</p>
          </div>
        )}

        {/* Grid Layout */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredImages.map((img) => (
              <div key={img.id} className="group bg-slate-900/40 backdrop-blur border border-slate-850 hover:border-slate-700/60 rounded-2xl overflow-hidden transition-all duration-300 flex flex-col shadow-lg shadow-slate-950/20">
                {/* Image display */}
                <div className="relative aspect-video overflow-hidden bg-slate-950 cursor-pointer" onClick={() => setActiveModalImage(img)}>
                  <img
                    src={img.url}
                    alt={img.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveModalImage(img); }}
                      className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur transition-all"
                      style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Inspect Metadata"
                    >
                      <Eye size={20} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload(img.url, `${img.id}${img.url.substring(img.url.lastIndexOf("."))}`); }}
                      className="p-2.5 rounded-full bg-red-650 bg-red-600 hover:bg-red-500 text-white shadow-lg transition-all"
                      style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Download Image"
                    >
                      <Download size={20} />
                    </button>
                  </div>
                  
                  {/* Image Type Badge */}
                  <span className="absolute bottom-3 start-3 text-[10px] font-semibold font-mono tracking-wider text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur">
                    {img.type.split(" ")[0]}
                  </span>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg text-white group-hover:text-red-500 transition-colors">{img.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{img.description}</p>
                  </div>
                  
                  <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-4">
                    {/* File specs */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>{img.dimensions}</span>
                      <span>{img.size}</span>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleDownload(img.url, `${img.id}${img.url.substring(img.url.lastIndexOf("."))}`)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors cursor-pointer"
                        style={{ minHeight: '44px' }}
                      >
                        <Download size={14} />
                        <span>Save</span>
                      </button>
                      <button
                        onClick={() => handleCopyLink(img.url, img.id)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                          copiedId === img.id
                            ? "bg-emerald-950/40 border-emerald-850 border-emerald-800 text-emerald-400"
                            : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-350 hover:text-white"
                        }`}
                        style={{ minHeight: '44px' }}
                      >
                        <Copy size={14} />
                        <span>Link</span>
                      </button>
                      <button
                        onClick={() => handleShare(img)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                        style={{ minHeight: '44px' }}
                      >
                        <Share2 size={14} />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List Layout */}
        {viewMode === "list" && (
          <div className="space-y-4">
            {filteredImages.map((img) => (
              <div key={img.id} className="group bg-slate-900/30 backdrop-blur border border-slate-850 hover:border-slate-800 rounded-xl overflow-hidden transition-all flex flex-col md:flex-row md:items-center p-4 gap-6">
                {/* Small preview image */}
                <div className="w-full md:w-44 aspect-video md:aspect-square rounded-lg overflow-hidden bg-slate-950 shrink-0 cursor-pointer" onClick={() => setActiveModalImage(img)}>
                  <img src={img.url} alt={img.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
                
                {/* Meta details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-lg text-white group-hover:text-red-500 transition-colors">{img.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">{img.description}</p>
                    </div>
                    <span className="hidden sm:inline-block text-[10px] font-semibold font-mono tracking-wider text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {img.type}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 pt-3 border-t border-slate-800/60 text-xs font-mono text-slate-500">
                    <span className="flex items-center gap-1">Dimensions: <strong className="text-slate-350">{img.dimensions}</strong></span>
                    <span className="flex items-center gap-1">Size: <strong className="text-slate-350">{img.size}</strong></span>
                    <span className="flex items-center gap-1">Path: <strong className="text-red-400/80">{img.url}</strong></span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-32">
                  <button
                    onClick={() => handleDownload(img.url, `${img.id}${img.url.substring(img.url.lastIndexOf("."))}`)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold bg-red-650 bg-red-600 hover:bg-red-550 hover:bg-red-550 hover:bg-red-500 text-white rounded-lg transition-colors cursor-pointer"
                    style={{ minHeight: '44px' }}
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => handleCopyLink(img.url, img.id)}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      copiedId === img.id
                        ? "bg-emerald-950/40 border-emerald-800 text-emerald-400"
                        : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-350 hover:text-white"
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    <Copy size={14} />
                    <span>Link</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating share notification */}
      <AnimatePresence>
        {shareToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 end-6 z-55 flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-800 px-4 py-3 shadow-2xl text-white text-xs font-mono font-medium"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>{shareToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen view modal */}
      <AnimatePresence>
        {activeModalImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-850 border-slate-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[90vh]"
            >
              {/* Media viewer */}
              <div className="flex-1 bg-black flex items-center justify-center relative p-6 max-h-[50vh] md:max-h-full overflow-hidden">
                <img
                  src={activeModalImage.url}
                  alt={activeModalImage.title}
                  className="max-w-full max-h-[40vh] md:max-h-[60vh] object-contain"
                />
              </div>

              {/* Sidebar specifications */}
              <div className="w-full md:w-80 p-6 border-t md:border-t-0 md:border-s border-slate-850 flex flex-col justify-between bg-slate-900">
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-bold text-lg text-white leading-tight">{activeModalImage.title}</h3>
                    <button
                      onClick={() => setActiveModalImage(null)}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      style={{ minWidth: '32px', minHeight: '32px' }}
                    >
                      ✕
                    </button>
                  </div>
                  
                  <p className="text-xs text-slate-400 leading-relaxed">{activeModalImage.description}</p>
                  
                  {/* Detailed Specs list */}
                  <div className="border-t border-slate-850 pt-4 space-y-2 text-xs font-mono">
                    <span className="block text-slate-500 uppercase tracking-widest text-[9px] mb-3">Specifications</span>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Resource URL</span>
                      <a href={activeModalImage.url} target="_blank" rel="noreferrer" className="text-red-400 hover:underline flex items-center gap-1 truncate max-w-[140px]">
                        {activeModalImage.url}
                        <ExternalLink size={10} />
                      </a>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Dimensions</span>
                      <span className="text-slate-300">{activeModalImage.dimensions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">File Size</span>
                      <span className="text-slate-300">{activeModalImage.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Format</span>
                      <span className="text-slate-300">{activeModalImage.type}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-850 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleDownload(activeModalImage.url, `${activeModalImage.id}${activeModalImage.url.substring(activeModalImage.url.lastIndexOf("."))}`)}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold bg-red-650 bg-red-600 hover:bg-red-550 hover:bg-red-500 text-white rounded-lg transition-colors cursor-pointer"
                    style={{ minHeight: '44px' }}
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => handleCopyLink(activeModalImage.url, activeModalImage.id)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      copiedId === activeModalImage.id
                        ? "bg-emerald-950/40 border-emerald-800 text-emerald-400"
                        : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-350 hover:text-white"
                    }`}
                    style={{ minHeight: '44px' }}
                  >
                    <Copy size={14} />
                    <span>{copiedId === activeModalImage.id ? "Copied" : "Copy Link"}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-slate-950/60 border-t border-slate-900 py-6 text-center text-xs text-slate-500 font-mono">
        &copy; {new Date().getFullYear()} AnaHon Media Platform. All rights reserved.
      </footer>
    </div>
  );
}
