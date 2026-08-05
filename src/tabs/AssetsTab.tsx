import React, { useState, FormEvent } from "react";
import { SharedProps } from "./shared";

export default function AssetsTab({ currentUser, formatUSD, refreshState, state, t, triggerToast }: SharedProps) {
  // Asset creation form
  const [assetName, setAssetName] = useState("");

  const [assetSerial, setAssetSerial] = useState("");

  const [assetCost, setAssetCost] = useState("");

  const [assetProject, setAssetProject] = useState("");

  const [assetLife, setAssetLife] = useState("3");

  const [assetCustodian, setAssetCustodian] = useState("");

  const [assetLocation, setAssetLocation] = useState("");

  const handleCapitalizeAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetName || !assetCost) {
      triggerToast("Specify asset name & acquisitions cost.", "error");
      return;
    }
    try {
      const res = await fetch("/api/assets/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: assetName,
          serialNumber: assetSerial || `SN-M-${Math.floor(Math.random() * 900000)}`,
          fundingProjectId: assetProject,
          purchaseDate: new Date().toISOString().split("T")[0],
          cost: assetCost,
          usefulLifeYears: assetLife,
          custodian: assetCustodian || "Mina Studio Coordinator",
          location: assetLocation || "Tripoli Principal Office",
          user: currentUser
        })
      });
      if (res.ok) {
        triggerToast("Acquisition loaded directly into asset register.");
        setAssetName("");
        setAssetCost("");
        refreshState();
      }
    } catch {
      triggerToast("Asset ledger save failed.", "error");
    }
  };
  return (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">{t("Fixed Assets capitalization Register")}</h2>
                  <p className="text-xs text-slate-500 md:max-w-xl">
                    Sinking cost models with straight-line automatic depreciation trackers mapped to physical serial numbers.
                  </p>
                </div>
              </div>

              {/* Capitalize Asset Form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <form onSubmit={handleCapitalizeAsset} className="p-4 bg-white border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Asset Name / Model")}</label>
                    <input
                      type="text"
                      placeholder="e.g. Sony FX6 camera"
                      value={assetName}
                      onChange={(e) => setAssetName(e.target.value)}
                      className="finance-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Acquisition Cost USD")}</label>
                    <input
                      type="number"
                      placeholder="Amount"
                      value={assetCost}
                      onChange={(e) => setAssetCost(e.target.value)}
                      className="finance-input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Vessel Project funding")}</label>
                    <select
                      value={assetProject}
                      onChange={(e) => setAssetProject(e.target.value)}
                      className="finance-input w-full"
                    >
                      <option value="">-- Direct Purchase or Code Link --</option>
                      {state.projects.map(p => (
                        <option key={p.id} value={p.id}>{p.code}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-650 uppercase mb-1">{t("Useful Life (Years)")}</label>
                    <select
                      value={assetLife}
                      onChange={(e) => setAssetLife(e.target.value)}
                      className="finance-input w-full font-mono"
                    >
                      <option value="2">2 Years</option>
                      <option value="3">3 Years</option>
                      <option value="4">4 Years</option>
                      <option value="5">5 Years</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-slate-900 hover:bg-slate-950 text-white text-xs font-semibold rounded px-4 py-2.5 shadow transition-all">
                    Capitalize Asset register
                  </button>
                </form>
              )}

              {/* Assets rollforward index register */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {state.fixedAssets.map(asset => (
                  <div key={asset.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">SERIAL NO: {asset.serialNumber}</span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${asset.condition === "Excellent" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>{asset.condition}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900">{asset.name}</h4>
                    <p className="text-xs text-slate-600">Location custody: {asset.location} / {asset.custodian}</p>

                    <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[9px] block text-slate-400">COST</span>
                        <span className="font-bold text-slate-800">{formatUSD(asset.cost)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] block text-slate-400">ACCUM DEP</span>
                        <span className="font-bold text-slate-800">-{formatUSD(asset.accumulatedDepreciation)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] block text-slate-400">BOOK VALUE</span>
                        <span className="font-bold text-red-650 font-bold text-red-650">{formatUSD(asset.currentBookValue)}</span>
                      </div>
                    </div>

                    {["Super Admin", "Auditor / Read-Only Reviewer"].includes(currentUser.role) && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <select
                          id={`cond-${asset.id}`}
                          className="bg-slate-100 text-xs px-2 py-1 rounded border border-slate-300 outline-none"
                        >
                          <option value="Excellent">Excellent condition</option>
                          <option value="Good">Good condition</option>
                          <option value="Needs Repair">Needs Repair</option>
                          <option value="Damaged">Damaged</option>
                        </select>
                        <button
                          onClick={async () => {
                            const cond = (document.getElementById(`cond-${asset.id}`) as HTMLSelectElement).value;
                            const res = await fetch("/api/assets/verify", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ assetId: asset.id, condition: cond, location: asset.location, user: currentUser })
                            });
                            if (res.ok) {
                              triggerToast("Asset condition verified on physical review.");
                              refreshState();
                            }
                          }}
                          className="text-[11px] bg-slate-900 text-white px-2.5 py-1 rounded shadow-sm"
                        >
                          Record audit verification check
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

            </div>
  );
}
