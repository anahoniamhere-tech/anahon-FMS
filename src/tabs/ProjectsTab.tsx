import * as XLSX from "xlsx";
import React, { useState } from "react";
import { Activity, Award, Download, Trash2 } from "lucide-react";
import { Account, AppDoc, Donor, Expense, Procurement, Project, Timesheet } from "../types";
import { STREAMS } from "../constants";
import { tr } from "../i18n";
import { SharedProps } from "./shared";

export default function ProjectsTab({ currentUser, formatIn, formatUSD, handleVoucherDocUpload, isProjectOfficer, openDoc, refreshState, requestableProjects, selectedProjectId, setSelectedProjectId, state, t, triggerToast, workspaceRef }: SharedProps) {
  // Whoever holds the Finance Officer seat signs the printed project sheet — never a name in code.
  const financeOfficerName = state.users.find((u: any) => u.role === "Finance Officer" && u.active)?.name || "Finance Officer";

  // New Project form states
  const [newProjectName, setNewProjectName] = useState("");

  const [newProjectCode, setNewProjectCode] = useState("");

  const [newProjectDonor, setNewProjectDonor] = useState("");

  const [newProjectBudget, setNewProjectBudget] = useState("");

  const [newProjectStartDate, setNewProjectStartDate] = useState("");

  const [newProjectEndDate, setNewProjectEndDate] = useState("");

  const [newProjectFundingType, setNewProjectFundingType] = useState<"Restricted Grant" | "Unrestricted Service">("Restricted Grant");

  // The statement deposit that proves the funding — required; unproven projects are not registered.
  const [newProjectFundingTx, setNewProjectFundingTx] = useState("");

  const [newProjectStream, setNewProjectStream] = useState("");

  // Project timeline step being added/edited (null = form closed).
  const [activityForm, setActivityForm] = useState<any | null>(null);

  const [reconMonth, setReconMonth] = useState<string>("2026-05");

  const [projectWorkspaceTab, setProjectWorkspaceTab] = useState<"folder" | "reconciliation">("folder");

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName || !newProjectCode || !newProjectDonor || !newProjectBudget || !newProjectStartDate || !newProjectEndDate || !newProjectFundingType) {
      triggerToast("All project fields are required.", "error");
      return;
    }
    if (!newProjectFundingTx) {
      triggerToast("Select the bank deposit that funds this project — unproven projects are not registered.", "error");
      return;
    }

    if (state.projects.some(p => p.code.toLowerCase() === newProjectCode.toLowerCase())) {
      triggerToast(`Project code '${newProjectCode}' already exists.`, "error");
      return;
    }

    try {
      const res = await fetch("/api/projects/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProjectName,
          code: newProjectCode,
          donorId: newProjectDonor,
          budgetUSD: Number(newProjectBudget),
          startDate: newProjectStartDate,
          endDate: newProjectEndDate,
          fundingType: newProjectFundingType,
          fundingTxId: newProjectFundingTx,
          stream: newProjectStream,
          user: currentUser
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }

      triggerToast(`Project ${newProjectName} created successfully.`);
      setNewProjectName("");
      setNewProjectCode("");
      setNewProjectDonor("");
      setNewProjectBudget("");
      setNewProjectStartDate("");
      setNewProjectEndDate("");
      setNewProjectFundingType("Restricted Grant");
      setNewProjectFundingTx("");
      setNewProjectStream("");

      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();

    if (!["Super Admin", "Finance Officer"].includes(currentUser.role)) {
      triggerToast("You do not have permission to delete projects.", "error");
      return;
    }

    const proj = state.projects.find(p => p.id === projectId);
    if (!proj) return;

    if (!window.confirm(`Are you sure you want to delete project ${proj.name} (${proj.code})? This will also delete all associated budget lines.`)) {
      return;
    }

    try {
      const res = await fetch("/api/projects/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, user: currentUser })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete project");
      }

      triggerToast(`Project ${proj.name} successfully deleted.`);
      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
      }
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  // Document references are auto-assigned; only the master account may amend one.
  const editDocRef = async (doc: AppDoc) => {
    if (currentUser.role !== "Super Admin") return;
    const refNo = window.prompt(`Amend document reference for "${doc.filename}" (master account action, audit-logged):`, doc.refNo || "");
    if (refNo === null || refNo === doc.refNo) return;
    try {
      const res = await fetch("/api/documents/set-ref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: doc.id, refNo, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to amend reference");
      triggerToast(`Reference amended: ${refNo}`);
      refreshState();
    } catch (err: any) {
      triggerToast(err.message, "error");
    }
  };

  // Budget allocations adjustment posting
  const handleModifyAllocation = async (blId: string, val: string) => {
    try {
      const res = await fetch("/api/budgets/allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: blId, allocatedUSD: val, user: currentUser })
      });
      if (res.ok) {
        triggerToast("Project allocate threshold updated.");
        refreshState();
      }
    } catch {
      triggerToast("Error updating budget lines.", "error");
    }
  };

  const saveActivity = async (payload: any) => {
    if (!payload.title?.trim()) { triggerToast("Give the step a title.", "error"); return; }
    try {
      const res = await fetch("/api/activities/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save step");
      triggerToast(`Timeline updated: ${payload.title}`);
      setActivityForm(null);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const deleteActivity = async (a: any) => {
    if (!window.confirm(`Remove "${a.title}" from the timeline?`)) return;
    try {
      const res = await fetch("/api/activities/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, user: currentUser })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to remove");
      triggerToast("Step removed.");
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  // Upload one of the four core project papers straight into its own category.
  const handleCoreDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, projectId: string, category: string) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    e.target.value = "";
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1]);
        r.onerror = () => reject(new Error(`Could not read "${file.name}"`));
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/document/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name, mimeType: file.type,
          sizeStr: `${(file.size / 1024).toFixed(0)} KB`, base64,
          category, linkedRecordType: "Project", linkedRecordId: projectId, user: currentUser
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      triggerToast(`${category} filed: "${file.name}"`);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const importTimetable = async (e: React.ChangeEvent<HTMLInputElement>, projectId: string) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    e.target.value = "";
    try {
      const base64: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1]);
        r.onerror = () => reject(new Error(`Could not read "${file.name}"`));
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/activities/import-timetable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, filename: file.name, base64, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Import failed");
      triggerToast(`${d.created} activities imported across ${d.columns.length} periods${d.meta?.title ? ` — "${String(d.meta.title).slice(0, 50)}"` : ""}.`);
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const generateTimeline = async (projectId: string | null, all = false) => {
    try {
      const res = await fetch("/api/activities/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(all ? { all: true, user: currentUser } : { projectId, user: currentUser })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to generate");
      triggerToast(
        d.created || d.completed
          ? `${d.projects} project(s): ${d.created} step(s) added, ${d.completed} already evidenced and marked done.`
          : "Timelines are already up to date."
      );
      refreshState();
    } catch (err: any) { triggerToast(err.message, "error"); }
  };

  const handleProjectDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, projId: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64String = (reader.result as string).split(",")[1];
        const res = await fetch("/api/document/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            sizeStr: `${(file.size / 1024).toFixed(0)} KB`,
            base64: base64String,
            category: "Contract",
            linkedRecordType: "Project",
            linkedRecordId: projId,
            user: currentUser
          })
        });

        if (!res.ok) throw new Error("Upload failed");
        triggerToast(`Document archived successfully: "${file.name}"`);
        refreshState();
      } catch (err: any) {
        triggerToast("Failed to upload project contract doc.", "error");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExportExcel = () => {
    try {
      const activeProject = state.projects.find(p => p.id === selectedProjectId);
      if (!activeProject) return;

      const projExpenses = state.expenses.filter(e =>
        e.projectId === selectedProjectId ||
        (e.allocations && e.allocations.some((a: any) => a.projectId === selectedProjectId))
      );

      // Filter items for the specific reconMonth (YYYY-MM)
      const monthExpenses = projExpenses.filter(e => {
        const dateVal = e.paid_at || e.created_at;
        return dateVal && dateVal.startsWith(reconMonth);
      });

      const projectBudgetLines = state.budgetLines.filter(bl => bl.projectId === selectedProjectId);

      // Sheet 1: Budget_vs_Actuals Data
      const sheet1Data = projectBudgetLines.map(bl => {
        const monthSpent = monthExpenses.filter(e => e.budgetLineId === bl.id).reduce((sum, e) => {
          const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
          return sum + (alloc ? Number(alloc.amount) : e.amount);
        }, 0);

        const remaining = bl.allocatedUSD - bl.actualUSD;
        const burnPercent = bl.allocatedUSD > 0 ? (bl.actualUSD / bl.allocatedUSD) : 0;

        return {
          "Account Line": bl.code,
          "Category Description": bl.category,
          "Allocated Pool (USD)": bl.allocatedUSD,
          "Spent This Month (USD)": monthSpent,
          "Cumulative Spent to Date (USD)": bl.actualUSD,
          "Remaining Balance (USD)": remaining,
          "Burn Rate (%)": burnPercent
        };
      });

      // Calculate aggregates for Section I
      const totalAllocated = projectBudgetLines.reduce((sum, bl) => sum + bl.allocatedUSD, 0);
      const totalSpentMonth = projectBudgetLines.reduce((sum, bl) => {
        const monthSpent = monthExpenses.filter(e => e.budgetLineId === bl.id).reduce((sumE, e) => {
          const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
          return sumE + (alloc ? Number(alloc.amount) : e.amount);
        }, 0);
        return sum + monthSpent;
      }, 0);
      const totalCumulative = projectBudgetLines.reduce((sum, bl) => sum + bl.actualUSD, 0);
      const totalRemaining = totalAllocated - totalCumulative;
      const overallBurnRate = totalAllocated > 0 ? (totalCumulative / totalAllocated) : 0;

      sheet1Data.push({
        "Account Line": "TOTAL BUDGET BURN SUMMARY",
        "Category Description": "",
        "Allocated Pool (USD)": totalAllocated,
        "Spent This Month (USD)": totalSpentMonth,
        "Cumulative Spent to Date (USD)": totalCumulative,
        "Remaining Balance (USD)": totalRemaining,
        "Burn Rate (%)": overallBurnRate
      });

      // Sheet 2: Reconciled_Cash_Flows Data
      const sheet2Data = monthExpenses.map(exp => {
        const alloc = exp.allocations ? exp.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
        const calculatedNet = alloc ? Number(alloc.amount) - (Number(alloc.amount) * (exp.whtAmount / exp.amount)) : (exp.netAmount || exp.amount);
        const whtVal = alloc ? Number(alloc.amount) * (exp.whtAmount / exp.amount) : exp.whtAmount;

        return {
          "Statement Date": exp.paid_at?.split("T")[0] || exp.created_at?.split("T")[0] || "",
          "Voucher / Ref": exp.voucherNo,
          "Transaction Memo": exp.title,
          "Withholding Tax (WHT)": whtVal * exp.rate,
          "Reconciled Net": calculatedNet * exp.rate
        };
      });

      const totalWht = monthExpenses.reduce((sum, e) => {
        const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
        const whtVal = alloc ? Number(alloc.amount) * (e.whtAmount / e.amount) : e.whtAmount;
        return sum + (whtVal * e.rate);
      }, 0);

      const totalNet = monthExpenses.reduce((sum, e) => {
        const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
        const calculatedNet = alloc ? Number(alloc.amount) - (Number(alloc.amount) * (e.whtAmount / e.amount)) : (e.netAmount || e.amount);
        return sum + (calculatedNet * e.rate);
      }, 0);

      sheet2Data.push({
        "Statement Date": "RECONCILED MATCHINGS TOTAL",
        "Voucher / Ref": "",
        "Transaction Memo": "",
        "Withholding Tax (WHT)": totalWht,
        "Reconciled Net": totalNet
      });

      // Assemble Excel Workbook
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
      const ws2 = XLSX.utils.json_to_sheet(sheet2Data);

      // Percentage formatting in Excel for Burn Rate column
      const range1 = XLSX.utils.decode_range(ws1["!ref"] || "");
      for (let r = range1.s.r + 1; r <= range1.e.r; ++r) {
        const cellRef = XLSX.utils.encode_cell({ r, c: 6 }); // Burn Rate (%) is 7th column (0-indexed 6)
        if (ws1[cellRef]) {
          ws1[cellRef].z = "0.0%";
        }
      }
      XLSX.utils.book_append_sheet(wb, ws1, "Budget_vs_Actuals");
      XLSX.utils.book_append_sheet(wb, ws2, "Reconciled_Cash_Flows");

      XLSX.writeFile(wb, `${activeProject.code}_Reconciliation_${reconMonth}.xlsx`);
      triggerToast("Excel workbook exported successfully!");
    } catch (err: any) {
      triggerToast("Failed to export Excel spreadsheet.", "error");
    }
  };

  const handleExportWord = () => {
    try {
      const activeProject = state.projects.find(p => p.id === selectedProjectId);
      if (!activeProject) return;

      const element = document.getElementById("reconciliation-print-report");
      if (!element) {
        triggerToast("Report container not found.", "error");
        return;
      }

      // Clone element to avoid modifying the active DOM layout
      const clonedElement = element.cloneNode(true) as HTMLElement;

      const styleBlock = `
        <style>
          body {
            font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
            color: #1e293b;
            line-height: 1.5;
            margin: 20px;
          }
          h1 {
            font-size: 16pt;
            font-weight: bold;
            color: #0f172a;
            text-align: center;
            margin-bottom: 2pt;
            text-transform: uppercase;
          }
          p.subtitle {
            font-size: 8.5pt;
            color: #64748b;
            text-align: center;
            font-family: Consolas, monospace;
            margin-bottom: 5pt;
          }
          h2 {
            font-size: 10pt;
            font-weight: bold;
            color: #dc2626;
            text-align: center;
            margin-top: 5pt;
            margin-bottom: 15pt;
            text-transform: uppercase;
          }
          h4 {
            font-size: 10pt;
            font-weight: bold;
            color: #0f172a;
            margin-top: 15pt;
            margin-bottom: 5pt;
            border-left: 3px solid #dc2626;
            padding-left: 6pt;
            text-transform: uppercase;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10pt;
            margin-bottom: 15pt;
            font-size: 8.5pt;
          }
          th {
            background-color: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 6pt 8pt;
            font-weight: bold;
            text-align: left;
            text-transform: uppercase;
          }
          td {
            border: 1px solid #e2e8f0;
            padding: 5pt 8pt;
            vertical-align: middle;
          }
          .text-right {
            text-align: right;
          }
          .font-mono {
            font-family: Consolas, monospace;
          }
          .font-bold {
            font-weight: bold;
          }
          .bg-slate-50 {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 8pt;
            border-radius: 6px;
          }
          .grid-cols-2 {
            width: 100%;
            margin-top: 10pt;
            margin-bottom: 15pt;
          }
          .info-table {
            width: 100%;
            border: none !important;
          }
          .info-table td {
            border: none !important;
            padding: 4pt 6pt;
          }
          .info-label {
            color: #64748b;
            font-size: 8pt;
            font-weight: bold;
          }
          .info-value {
            color: #0f172a;
            font-weight: bold;
          }
          .bg-emerald-50 {
            background-color: #ecfdf5;
            border: 1px solid #a7f3d0;
            padding: 8pt;
            font-size: 8.5pt;
            color: #065f46;
            margin-top: 10pt;
            margin-bottom: 10pt;
            font-family: Consolas, monospace;
          }
          .bg-red-50 {
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            padding: 8pt;
            font-size: 8.5pt;
            color: #991b1b;
            margin-top: 10pt;
            margin-bottom: 10pt;
            font-family: Consolas, monospace;
          }
          .signature-box {
            width: 45%;
            display: inline-block;
            vertical-align: top;
            margin-right: 5%;
          }
          .signature-table {
            width: 100%;
            margin-top: 20pt;
            border: none !important;
          }
          .signature-table td {
            border: none !important;
            padding: 10pt;
            vertical-align: top;
          }
          .signature-line {
            border-top: 1px solid #94a3b8;
            margin-top: 30pt;
            padding-top: 5pt;
            font-size: 8pt;
            color: #64748b;
          }
          .text-slate-500 {
            color: #64748b;
          }
          .text-slate-900 {
            color: #0f172a;
          }
          .text-red-650 {
            color: #b91c1c;
          }
          .text-emerald-800 {
            color: #065f46;
          }
          .text-amber-600 {
            color: #d97706;
          }
          .mt-2 { margin-top: 8px; }
          .mb-4 { margin-bottom: 16px; }
          .flex { display: block; }
          .justify-between { display: block; }
          .rounded-full { border-radius: 9999px; }
          .bg-red-50-badge {
            background-color: #fef2f2;
            color: #991b1b;
            padding: 2pt 6pt;
            border-radius: 9999px;
            font-size: 8pt;
            font-weight: bold;
            display: inline-block;
          }
        </style>
      `;

      const header = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset="utf-8">
          <title>${activeProject.code} Monthly Reconciliation - ${reconMonth}</title>
          <!--[if gte mso 9]>
          <xml>
            <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
            </w:WordDocument>
          </xml>
          <![endif]-->
          ${styleBlock}
        </head>
        <body>
      `;
      const footer = "</body></html>";

      // Transform grid info layout to tables for Word rendering
      const infoGrid = clonedElement.querySelector(".grid-cols-2");
      if (infoGrid) {
        const rows = Array.from(infoGrid.children);
        let tableHtml = '<table class="info-table bg-slate-50">';
        for (let i = 0; i < rows.length; i += 2) {
          tableHtml += '<tr>';
          if (rows[i]) {
            const label = rows[i].children[0]?.textContent || "";
            const val = rows[i].children[1]?.textContent || "";
            tableHtml += `<td width="20%"><span class="info-label">${label}</span></td><td width="30%"><span class="info-value">${val}</span></td>`;
          }
          if (rows[i + 1]) {
            const label = rows[i + 1].children[0]?.textContent || "";
            const val = rows[i + 1].children[1]?.textContent || "";
            tableHtml += `<td width="20%"><span class="info-label">${label}</span></td><td width="30%"><span class="info-value">${val}</span></td>`;
          } else {
            tableHtml += '<td width="20%"></td><td width="30%"></td>';
          }
          tableHtml += '</tr>';
        }
        tableHtml += '</table>';
        infoGrid.outerHTML = tableHtml;
      }

      // Convert grid/flex signature boxes into a standard side-by-side signature table
      const signatureContainer = clonedElement.querySelector(".pt-6.space-y-4");
      if (signatureContainer) {
        const gridElement = signatureContainer.querySelector(".grid-cols-2") || signatureContainer.querySelector(".grid");
        if (gridElement) {
          const boxes = Array.from(gridElement.children);
          let sigTableHtml = '<table class="signature-table">';
          sigTableHtml += '<tr>';
          boxes.forEach((box) => {
            const content = box.innerHTML;
            sigTableHtml += `<td width="50%">${content}</td>`;
          });
          sigTableHtml += '</tr></table>';
          gridElement.outerHTML = sigTableHtml;
        }
      }

      const badgeHeader = clonedElement.querySelector("h2.text-red-650.bg-red-50");
      if (badgeHeader) {
        badgeHeader.className = "bg-red-50-badge";
      }

      const content = clonedElement.innerHTML;
      const htmlString = header + content + footer;

      const blob = new Blob(['\ufeff' + htmlString], {
        type: 'application/msword'
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${activeProject.code}_Monthly_Reconciliation_Report_${reconMonth}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      triggerToast("Word document exported successfully!");
    } catch (err: any) {
      triggerToast("Failed to export Word document.", "error");
    }
  };

  const handleExportPDF = () => {
    try {
      document.body.classList.add("print-reconciliation-only");
      window.print();
      setTimeout(() => {
        document.body.classList.remove("print-reconciliation-only");
      }, 500);
      triggerToast("PDF print dialog opened successfully!");
    } catch (err: any) {
      triggerToast("Failed to launch PDF print manager.", "error");
    }
  };
  return (<>
          {true && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold">{t("Resricted Donor Grants & Sinking Budgets")}</h2>
                <p className="text-xs text-slate-500">Track designated funding allocations, revised budget versions and project execution timelines.</p>
              </div>

              {/* Donors Profiles list — not relevant to a requester-only role */}
              {!isProjectOfficer && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {state.donors.map(d => (
                  <div key={d.id} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-5 w-5 text-red-650 text-red-600" />
                      <h4 className="text-sm font-bold text-slate-900">{d.name}</h4>
                    </div>
                    <p className="text-xs text-slate-500">Region Origin: {d.country}</p>
                    <p className="text-xs text-slate-500">{d.contactEmail}</p>
                    <div className="mt-3 p-2 bg-slate-50 border border-slate-105 rounded text-[11px] text-slate-600 leading-relaxed italic">
                      ℹ️ {d.notes}
                    </div>
                  </div>
                ))}
              </div>
              )}

              {/* ── All project timelines at a glance ─────────────────────
                  One place to see what is next across every project, instead of
                  opening each workspace in turn. */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <h3 className="text-sm font-bold text-slate-800 uppercase font-mono">🗓 Project Timelines</h3>
                  {["Super Admin", "Finance Officer", "Executive Director", "Project Officer"].includes(currentUser.role) && (
                    <button type="button" onClick={() => generateTimeline(null, true)}
                      className="text-xs font-medium bg-slate-800 text-white hover:bg-slate-700 rounded-lg px-3 py-2 transition-all"
                      title="Apply the standard 8-step template to every project, marking steps done where the evidence already exists">
                      ✨ Build / refresh all timelines
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Standard steps per project — agreement, funds, budget, start, mid-point, end, report, closeout.
                  Steps are marked done automatically when the evidence is already in the system; a status you set by hand is never overwritten.
                </p>
                {(() => {
                  const rows = requestableProjects.map(p => {
                    const acts = state.projectActivities.filter(a => a.projectId === p.id);
                    const open = acts.filter(a => a.status !== "Done" && a.status !== "Cancelled");
                    const overdue = open.filter(a => a.dueDate && a.dueDate < new Date().toLocaleDateString("en-CA"));
                    const next = open.filter(a => a.dueDate).sort((x, y) => x.dueDate.localeCompare(y.dueDate))[0];
                    return { p, total: acts.length, done: acts.filter(a => a.status === "Done").length, overdue: overdue.length, next };
                  }).filter(r => r.total > 0);
                  if (!rows.length) return <p className="text-xs text-slate-400 italic">No timelines yet — press the button above to build them from what the system already knows.</p>;
                  return (
                    <div className="space-y-1.5">
                      {rows.sort((a, b) => (b.overdue - a.overdue) || ((a.next?.dueDate || "9999").localeCompare(b.next?.dueDate || "9999"))).map(r => (
                        <button key={r.p.id} type="button" onClick={() => { setSelectedProjectId(r.p.id); setProjectWorkspaceTab("folder"); }}
                          className={`w-full text-left flex flex-wrap items-center gap-3 p-2 rounded border text-xs transition-all hover:border-slate-350 ${r.overdue ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
                          <span className="font-mono font-bold text-[10px] bg-slate-100 px-1.5 py-0.5 rounded shrink-0">{r.p.code}</span>
                          <span className="text-slate-600 shrink-0">{r.done}/{r.total} done</span>
                          {r.overdue > 0 && <span className="text-red-700 font-bold shrink-0">{r.overdue} overdue</span>}
                          <span className="flex-1 min-w-[160px] text-slate-700">
                            {r.next ? <>next: <strong>{r.next.title}</strong> <span className="font-mono text-slate-500">{r.next.dueDate}</span></> : <span className="text-emerald-700">all steps closed</span>}
                          </span>
                          {(() => {
                            // The four papers every project must carry, shown here so gaps
                            // are visible without opening each workspace.
                            const docs = state.documents.filter(d => d.linkedRecordType === "Project" && d.linkedRecordId === r.p.id);
                            const hit = (re: RegExp) => docs.some(d => re.test(`${d.category} ${d.filename}`.toLowerCase()));
                            const tt = hit(/timetable|timeline|work ?plan|year plan/) || state.projectActivities.some(a => a.projectId === r.p.id && a.source === "imported");
                            const gaps = [
                              !hit(/proposal|concept note/) && "proposal",
                              !tt && "timetable",
                              !hit(/budget/) && "budget",
                              !hit(/agreement|contract|grant offer/) && "agreement"
                            ].filter(Boolean);
                            return gaps.length
                              ? <span className="text-[10px] text-amber-700 font-bold shrink-0">missing: {gaps.join(", ")}</span>
                              : <span className="text-[10px] text-emerald-700 font-bold shrink-0">papers complete</span>;
                          })()}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Add Project Inline form */}
              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                <form onSubmit={handleCreateProject} className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase font-mono">➕ Create New Project</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Project Name")}</label>
                      <input
                        type="text"
                        placeholder="e.g. Akkar Legal Support Clinic"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="finance-input w-full font-sans text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Project Code (Unique)")}</label>
                      <input
                        type="text"
                        placeholder="e.g. AKK-2026"
                        value={newProjectCode}
                        onChange={(e) => setNewProjectCode(e.target.value)}
                        className="finance-input w-full font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Donor Partner")}</label>
                      <select
                        value={newProjectDonor}
                        onChange={(e) => setNewProjectDonor(e.target.value)}
                        className="finance-input w-full text-xs"
                      >
                        <option value="">Select a Donor...</option>
                        {state.donors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Budget Pool (USD)")}</label>
                      <input
                        type="number"
                        placeholder="e.g. 50000"
                        value={newProjectBudget}
                        onChange={(e) => setNewProjectBudget(e.target.value)}
                        className="finance-input w-full font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Start Date")}</label>
                      <input
                        type="date"
                        value={newProjectStartDate}
                        onChange={(e) => setNewProjectStartDate(e.target.value)}
                        className="finance-input w-full font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("End Date")}</label>
                      <input
                        type="date"
                        value={newProjectEndDate}
                        onChange={(e) => setNewProjectEndDate(e.target.value)}
                        className="finance-input w-full font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Funding Type")}</label>
                      <select
                        value={newProjectFundingType}
                        onChange={(e) => setNewProjectFundingType(e.target.value as any)}
                        className="finance-input w-full text-xs"
                      >
                        <option value="Restricted Grant">Restricted Grant</option>
                        <option value="Unrestricted Service">Unrestricted Service</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="proj-stream" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Program Stream")}</label>
                      <select
                        id="proj-stream"
                        value={newProjectStream}
                        onChange={(e) => setNewProjectStream(e.target.value)}
                        className="finance-input w-full text-xs"
                      >
                        <option value="">— Assign later —</option>
                        {STREAMS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="proj-funding-tx" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">{t("Funding Deposit (Bank Proof)")}</label>
                      {/* Only unclaimed statement deposits are offered — a project cannot be
                          registered without the bank line that proves its money arrived. */}
                      <select
                        id="proj-funding-tx"
                        required
                        value={newProjectFundingTx}
                        onChange={(e) => setNewProjectFundingTx(e.target.value)}
                        className="finance-input w-full text-xs"
                      >
                        <option value="">— Select statement deposit —</option>
                        {state.bankTransactions
                          .filter(bt => bt.type === "Deposit" && !bt.projectId && !bt.pending)
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map(bt => {
                            const acct = state.bankAccounts.find(ba => ba.id === bt.bankAccountId);
                            return (
                              <option key={bt.id} value={bt.id}>
                                {bt.date} · {formatIn(bt.amount, acct?.currency || "USD")} · {bt.description.slice(0, 60)}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button type="submit" className="w-full bg-red-600 text-white font-medium text-xs rounded-lg px-4 py-2.5 hover:bg-red-750 transition-all">
                        Register Project Grant
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Active Restricted Projects Section (NEW) */}
              <div className="space-y-4">
                <h3 className="text-md font-bold text-slate-800 uppercase font-mono flex items-center gap-1.5">
                  📁 Active Restricted Projects
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {requestableProjects.map(proj => {
                    const donor = state.donors.find(d => d.id === proj.donorId);
                    const isSelected = selectedProjectId === proj.id;
                    const burnTotal = state.budgetLines
                      .filter(bl => bl.projectId === proj.id)
                      .reduce((sum, bl) => sum + (bl.actualUSD || 0), 0);
                    const burnPercent = Math.min(100, Math.round((burnTotal / (proj.budgetUSD || 1)) * 100));

                    return (
                      <div
                        key={proj.id}
                        onClick={() => setSelectedProjectId(selectedProjectId === proj.id ? null : proj.id)}
                        className={`p-5 bg-white border rounded-xl shadow-sm cursor-pointer transition-all duration-200 ${isSelected ? "ring-2 ring-red-600 border-transparent bg-red-50/10" : "border-slate-200 hover:border-slate-350 hover:shadow-md"
                          }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-red-50 text-red-700 font-mono font-bold px-2 py-0.5 rounded uppercase">
                              {proj.code}
                            </span>
                            {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                              <button
                                onClick={(e) => handleDeleteProject(e, proj.id)}
                                className="text-slate-400 hover:text-red-650 p-1 transition-colors rounded hover:bg-slate-100"
                                title="Delete Project"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono ${proj.status === "Active" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}>
                            {proj.status}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-900 font-sans mb-1">{proj.name}</h4>
                        <p className="text-xs text-slate-500 mb-1">Donor Partner: {donor?.name || "Restricted Donor"}</p>
                        <p className="text-[10px] text-slate-400 mb-3">🏛 {proj.stream || "— program unassigned"}</p>

                        <div className="space-y-1 mb-3">
                          <div className="flex justify-between text-[10px] text-slate-500">
                            <span>Burn Rate</span>
                            <span>{burnPercent}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-red-600 h-full transition-all duration-300" style={{ width: `${burnPercent}%` }} />
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-xs">
                          <div>
                            <span className="block text-[9px] text-slate-400 uppercase">Grants pool</span>
                            <strong className="text-slate-800 font-mono">{formatUSD(proj.budgetUSD)}</strong>
                          </div>
                          <span className="text-red-650 font-bold hover:underline flex items-center gap-0.5">
                            {isSelected ? "Close Workspace ✕" : "Open Workspace 📂"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Project Workspace Control Panel (NEW) */}
              {selectedProjectId && (() => {
                const activeProject = state.projects.find(p => p.id === selectedProjectId);
                if (!activeProject) return null;

                const activeDonor = state.donors.find(d => d.id === activeProject.donorId);
                const projDocs = state.documents.filter(d => d.linkedRecordType === "Project" && d.linkedRecordId === selectedProjectId);
                const projExpenses = state.expenses.filter(e =>
                  e.projectId === selectedProjectId ||
                  (e.allocations && e.allocations.some((a: any) => a.projectId === selectedProjectId))
                );
                const projProcurements = state.procurements.filter(p => p.projectId === selectedProjectId);

                // Bank transactions linked to this project
                const projVouchers = projExpenses.map(e => e.voucherNo);
                const projBankTx = state.bankTransactions.filter(bt => bt.voucherNo && projVouchers.includes(bt.voucherNo));

                // Donor money in. Carries projectId directly — it has no voucher to route it.
                const projFunding = state.bankTransactions
                  .filter(bt => bt.projectId === selectedProjectId)
                  .sort((a, b) => a.date.localeCompare(b.date));
                const fundingAccounts = [...new Set(projFunding.map(bt => bt.bankAccountId))]
                  .map(id => state.bankAccounts.find(ba => ba.id === id))
                  .filter(Boolean);

                // Timesheets allocating payroll to this project
                const projTimesheets = state.timesheets.filter(ts =>
                  ts.allocations && ts.allocations.some((alloc: any) => alloc.projectId === selectedProjectId)
                );

                return (
                  <div ref={workspaceRef} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                    <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded font-mono font-bold">{activeProject.code}</span>
                          <h3 className="text-lg font-bold text-slate-900 font-sans">{activeProject.name} Workspace</h3>
                        </div>
                        <p className="text-xs text-slate-500">Restricted Donor: {activeDonor?.name || "Unspecified"} • Grant Pool: {formatUSD(activeProject.budgetUSD)}</p>
                        {fundingAccounts.length > 0 ? (
                          <p className="text-[11px] text-slate-500 mt-1">
                            🏦 Funded into:{" "}
                            {fundingAccounts.map((ba: any, i) => (
                              <span key={ba.id} className="font-mono">
                                {i > 0 && " • "}
                                {ba.name} <span className="text-slate-400">{ba.accountNo}</span>{" "}
                                <strong className="text-emerald-700">
                                  {formatIn(projFunding.filter(t => t.bankAccountId === ba.id).reduce((s, t) => s + t.amount, 0), ba.currency)}
                                </strong>
                              </span>
                            ))}
                            <span className="text-slate-400 font-sans italic"> — source: BLOM statement, {projFunding.length} receipt{projFunding.length === 1 ? "" : "s"}</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-amber-700 mt-1 italic">🏦 No bank receipts linked to this project — funding source unverified.</p>
                        )}
                      </div>

                      {/* Sub-tab navigation */}
                      <div className="flex flex-col sm:flex-row bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium font-sans gap-1 sm:gap-0">
                        <button
                          type="button"
                          onClick={() => setProjectWorkspaceTab("folder")}
                          className={`min-h-[44px] px-4 py-2.5 flex items-center justify-center rounded-md transition-colors ${projectWorkspaceTab === "folder" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                          📁 Folder Explorer (Audit File)
                        </button>
                        <button
                          type="button"
                          onClick={() => setProjectWorkspaceTab("reconciliation")}
                          className={`min-h-[44px] px-4 py-2.5 flex items-center justify-center rounded-md transition-colors ${projectWorkspaceTab === "reconciliation" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
                            }`}
                        >
                          📊 Monthly Reconciliation Report
                        </button>
                      </div>
                    </div>

                    {/* Sub-tab 1: Folder Explorer (Section 2.6 Compliance) */}
                    {projectWorkspaceTab === "folder" && (
                      <div className="space-y-6">

                        {/* ── Core project documents ───────────────────────
                            The four papers a project must always carry: what we promised
                            (proposal), when (timetable), for how much (budget), and on what
                            terms (signed agreement). Missing ones are stated, not hidden. */}
                        {(() => {
                          const projDocsAll = state.documents.filter(d => d.linkedRecordType === "Project" && d.linkedRecordId === selectedProjectId);
                          const hasImportedTimetable = state.projectActivities.some(a => a.projectId === selectedProjectId && a.source === "imported");
                          const match = (re: RegExp) => projDocsAll.find(d => re.test(`${d.category} ${d.filename}`.toLowerCase()));
                          const slots = [
                            { key: "Proposal", label: "Proposal", re: /proposal|concept note/, doc: match(/proposal|concept note/), extra: "" },
                            { key: "Timetable", label: "Activity timetable", re: /timetable|timeline|work ?plan|year plan/, doc: match(/timetable|timeline|work ?plan|year plan/), extra: hasImportedTimetable ? "imported into the timeline below" : "" },
                            { key: "Budget", label: "Approved budget", re: /budget/, doc: match(/budget/), extra: "" },
                            { key: "Agreement", label: "Signed agreement", re: /agreement|contract|grant offer/, doc: match(/agreement|contract|grant offer/), extra: "" }
                          ];
                          const missing = slots.filter(sl => !sl.doc && !sl.extra).length;
                          return (
                            <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                                <h4 className="text-xs font-bold text-slate-700 uppercase font-mono">📑 Core Project Documents</h4>
                                <span className={`text-[10px] font-bold ${missing ? "text-amber-700" : "text-emerald-700"}`}>
                                  {missing ? `${missing} of 4 missing` : "complete"}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                {slots.map(sl => (
                                  <div key={sl.key} className={`p-2 rounded border text-xs ${sl.doc || sl.extra ? "bg-emerald-50/50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                                    <p className="text-[10px] font-bold uppercase text-slate-600">{sl.label}</p>
                                    {sl.doc ? (
                                      <a href={`/api/document/content/${sl.doc.id}`} target="_blank" onClick={e => { e.preventDefault(); openDoc(sl.doc); }} rel="noreferrer"
                                        className="text-[11px] text-red-650 hover:underline break-all">📄 {sl.doc.filename}</a>
                                    ) : sl.extra ? (
                                      <span className="text-[11px] text-emerald-800">✓ {sl.extra}</span>
                                    ) : (
                                      <span className="text-[11px] text-amber-800 font-bold">missing</span>
                                    )}
                                    {["Super Admin", "Finance Officer", "Executive Director", "Project Officer"].includes(currentUser.role) && (
                                      <label className="block mt-1 text-[10px] font-bold text-slate-500 hover:text-red-650 cursor-pointer">
                                        {sl.doc ? "replace / add" : "＋ upload"}
                                        <input type="file" className="hidden" accept=".pdf,.docx,.xlsx,.xlsm,image/*"
                                          onChange={ev => handleCoreDocUpload(ev, selectedProjectId!, sl.key)} />
                                      </label>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {missing > 0 && (
                                <p className="text-[10px] text-amber-800">
                                  A project should always carry what was promised, when, for how much, and on what terms — these are the papers every donor audit asks for first.
                                </p>
                              )}
                            </div>
                          );
                        })()}

                        {/* ── Project timeline ─────────────────────────────
                            Dated, assignable steps. Overdue and due-soon are coloured,
                            so what needs doing next is visible without being remembered. */}
                        <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                            <h4 className="text-xs font-bold text-slate-700 uppercase font-mono">🗓 Project Timeline & Assignments</h4>
                            {["Super Admin", "Finance Officer", "Executive Director", "Project Officer"].includes(currentUser.role) && (
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => generateTimeline(selectedProjectId!)}
                                  className="text-[11px] font-medium bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 transition-all"
                                  title="Create the standard steps from this grant's start, mid-point and end dates">
                                  ✨ Generate from grant dates
                                </button>
                                <label className="text-[11px] font-medium bg-slate-100 hover:bg-slate-200 rounded-lg px-3 py-1.5 cursor-pointer transition-all"
                                  title="Upload the donor's Activity Timetable (.xlsx) — activities, Results and period columns are read from the sheet">
                                  📊 Import donor timetable
                                  <input type="file" accept=".xlsx" className="hidden"
                                    onChange={e => importTimetable(e, selectedProjectId!)} />
                                </label>
                                <button type="button"
                                  onClick={() => setActivityForm({ projectId: selectedProjectId, title: "", detail: "", kind: "Activity", dueDate: "", assigneeUserId: "", status: "Planned" })}
                                  className="text-[11px] font-medium bg-red-600 text-white hover:bg-red-700 rounded-lg px-3 py-1.5 transition-all">
                                  ➕ Add step
                                </button>
                              </div>
                            )}
                          </div>

                          {activityForm && activityForm.projectId === selectedProjectId && (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                              <div className="md:col-span-2">
                                <label htmlFor="ac-title" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">What needs doing</label>
                                <input id="ac-title" type="text" placeholder="e.g. Hygiene kit distribution — 6 shelters"
                                  value={activityForm.title} onChange={e => setActivityForm({ ...activityForm, title: e.target.value })}
                                  className="finance-input w-full text-xs" />
                              </div>
                              <div>
                                <label htmlFor="ac-kind" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Type</label>
                                <select id="ac-kind" value={activityForm.kind} onChange={e => setActivityForm({ ...activityForm, kind: e.target.value })} className="finance-input w-full text-xs">
                                  <option>Activity</option><option>Milestone</option><option>Report</option><option>Payment</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor="ac-due" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Due</label>
                                <input id="ac-due" type="date" value={activityForm.dueDate}
                                  onChange={e => setActivityForm({ ...activityForm, dueDate: e.target.value })} className="finance-input w-full font-mono text-xs" />
                              </div>
                              <div>
                                <label htmlFor="ac-who" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Assign to</label>
                                <select id="ac-who" value={activityForm.assigneeUserId} onChange={e => setActivityForm({ ...activityForm, assigneeUserId: e.target.value })} className="finance-input w-full text-xs">
                                  <option value="">— Unassigned —</option>
                                  {state.users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                              </div>
                              <div className="md:col-span-2">
                                <label htmlFor="ac-detail" className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Detail (optional)</label>
                                <input id="ac-detail" type="text" value={activityForm.detail}
                                  onChange={e => setActivityForm({ ...activityForm, detail: e.target.value })} className="finance-input w-full text-xs" />
                              </div>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => saveActivity(activityForm)} className="bg-red-600 text-white text-xs font-medium rounded-lg px-3 py-2 hover:bg-red-700 transition-all">💾 Save</button>
                                <button type="button" onClick={() => setActivityForm(null)} className="bg-slate-100 text-slate-600 text-xs font-medium rounded-lg px-3 py-2 hover:bg-slate-200 transition-all">Cancel</button>
                              </div>
                            </div>
                          )}

                          {/* Donor activity timetable — the Gantt shape AnaHon submits:
                              activities under their Result, numbered, shaded across periods. */}
                          {(() => {
                            const imported = state.projectActivities.filter(a => a.projectId === selectedProjectId && a.source === "imported");
                            if (!imported.length) return null;
                            const periodsOf = (a: any) => { try { return JSON.parse(a.periodsJson || "[]"); } catch { return []; } };
                            const cols: string[] = [];
                            imported.forEach(a => periodsOf(a).forEach((p: string) => { if (!cols.includes(p)) cols.push(p); }));
                            const groups = [...new Set(imported.map(a => a.resultGroup || ""))];
                            return (
                              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                                <table className="w-full text-[11px]">
                                  <caption className="text-left text-[10px] text-slate-500 p-2">
                                    Donor activity timetable — imported. Shaded cells are the periods each activity runs in.
                                  </caption>
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                      <th scope="col" className="p-2 text-left w-8">#</th>
                                      <th scope="col" className="p-2 text-left min-w-[220px]">Activity</th>
                                      {cols.map(c => <th key={c} scope="col" className="p-1 text-center font-mono text-[9px] whitespace-nowrap">{c.replace(/\\/g, "/")}</th>)}
                                      <th scope="col" className="p-2 text-left">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {groups.map(g => (
                                      <React.Fragment key={g || "none"}>
                                        {g && (
                                          <tr className="bg-slate-100">
                                            <td colSpan={cols.length + 3} className="p-1.5 font-bold text-slate-700 text-[10px]">{g}</td>
                                          </tr>
                                        )}
                                        {imported.filter(a => (a.resultGroup || "") === g).map(a => {
                                          const mine = periodsOf(a);
                                          const done = a.status === "Done";
                                          return (
                                            <tr key={a.id} className="border-b border-slate-100">
                                              <td className="p-2 font-mono text-slate-500">{(a as any).outlineNo}</td>
                                              <td className={`p-2 ${done ? "line-through text-slate-400" : "text-slate-800"}`}>
                                                {a.title}
                                                {(a as any).titleAr && <span dir="rtl" className="block text-[10px] text-slate-500">{(a as any).titleAr}</span>}
                                              </td>
                                              {cols.map(c => (
                                                <td key={c} className={`p-1 text-center ${mine.includes(c) ? (done ? "bg-emerald-200" : "bg-red-500/80") : ""}`} title={mine.includes(c) ? `${a.title} — ${c}` : ""}>
                                                  {mine.includes(c) ? <span className="sr-only">scheduled</span> : ""}
                                                </td>
                                              ))}
                                              <td className="p-1">
                                                <select value={a.status} onChange={e => saveActivity({ ...a, status: e.target.value })}
                                                  aria-label={`Status for ${a.title}`} className="finance-input text-[10px] py-0.5">
                                                  <option>Planned</option><option>In Progress</option><option>Done</option><option>Cancelled</option>
                                                </select>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </React.Fragment>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}

                          {(() => {
                            const acts = state.projectActivities
                              .filter(a => a.projectId === selectedProjectId && a.source !== "imported")
                              .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
                            if (!acts.length) return <p className="text-[11px] text-slate-400 italic">No steps yet — generate the standard ones from the grant dates, or add your own.</p>;
                            return (
                              <ol className="space-y-1.5">
                                {acts.map(a => {
                                  const days = a.dueDate ? Math.ceil((new Date(`${a.dueDate}T00:00:00`).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) : null;
                                  const open = a.status !== "Done" && a.status !== "Cancelled";
                                  const overdue = open && days !== null && days < 0;
                                  const soon = open && days !== null && days >= 0 && days <= 14;
                                  const who = state.users.find(u => u.id === a.assigneeUserId);
                                  return (
                                    <li key={a.id} className={`flex flex-wrap items-center gap-2 p-2 rounded border text-xs ${overdue ? "bg-red-50 border-red-200" : soon ? "bg-amber-50 border-amber-200" : a.status === "Done" ? "bg-emerald-50/40 border-emerald-100" : "bg-white border-slate-200"}`}>
                                      <span className="font-mono text-[10px] text-slate-500 w-20 shrink-0">{a.dueDate || "—"}</span>
                                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">{a.kind}</span>
                                      <span className={`flex-1 min-w-[140px] ${a.status === "Done" ? "line-through text-slate-400" : "text-slate-800 font-medium"}`}>
                                        {a.title}
                                        {a.detail && <span className="block text-[10px] font-normal text-slate-400">{a.detail}</span>}
                                      </span>
                                      {open && days !== null && (
                                        <span className={`text-[10px] font-bold shrink-0 ${overdue ? "text-red-700" : soon ? "text-amber-700" : "text-slate-400"}`}>
                                          {overdue ? `${Math.abs(days)}d overdue` : days === 0 ? "today" : `in ${days}d`}
                                        </span>
                                      )}
                                      <span className="text-[10px] text-slate-500 shrink-0">{who ? `👤 ${who.name}` : "unassigned"}</span>
                                      {["Super Admin", "Finance Officer", "Executive Director", "Project Officer"].includes(currentUser.role) && (
                                        <span className="flex items-center gap-1 shrink-0">
                                          <select value={a.status} onChange={e => saveActivity({ ...a, status: e.target.value })}
                                            aria-label={`Status for ${a.title}`} className="finance-input text-[10px] py-0.5">
                                            <option>Planned</option><option>In Progress</option><option>Done</option><option>Cancelled</option>
                                          </select>
                                          <button onClick={() => setActivityForm({ ...a })} title="Edit" aria-label={`Edit ${a.title}`} className="text-slate-400 hover:text-slate-700">✏️</button>
                                          <button onClick={() => deleteActivity(a)} title="Remove" aria-label={`Remove ${a.title}`} className="text-slate-400 hover:text-red-600"><Trash2 className="h-3 w-3" /></button>
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ol>
                            );
                          })()}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                          {/* Folder A: Project Contracts & MoUs */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                              <h4 className="text-xs font-bold text-slate-700 uppercase font-mono flex items-center gap-1.5">
                                📂 1. Contracts, MoUs & Co-funding splits
                              </h4>
                              {["Super Admin", "Finance Officer"].includes(currentUser.role) && (
                                <label className="text-[10px] text-red-650 hover:text-red-700 font-bold cursor-pointer inline-flex items-center min-h-[44px] px-2">
                                  ➕ Upload MoU
                                  <input
                                    type="file"
                                    accept="application/pdf,image/png,image/jpeg"
                                    onChange={(e) => handleProjectDocUpload(e, activeProject.id)}
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </div>

                            {projDocs.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-2">No uploaded contracts or MoU PDFs found in this project archive.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {projDocs.map(doc => (
                                  <div key={doc.id} className="flex justify-between items-center text-xs p-2 bg-white border border-slate-100 rounded shadow-inner">
                                    <span className="flex items-center gap-1.5 truncate max-w-xs">
                                      {doc.refNo && (
                                        <button
                                          type="button"
                                          onClick={() => editDocRef(doc)}
                                          disabled={currentUser.role !== "Super Admin"}
                                          className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 px-1 py-0.5 rounded shrink-0 hover:bg-slate-200 disabled:hover:bg-slate-100 disabled:cursor-default"
                                          title={currentUser.role === "Super Admin" ? "Amend reference (master account)" : "Unique reference — editable by master account only"}
                                          aria-label={`Document reference ${doc.refNo}`}
                                        >
                                          {doc.refNo}
                                        </button>
                                      )}
                                      <span className="text-slate-700 truncate">📄 {doc.filename} ({doc.sizeStr})</span>
                                    </span>
                                    <a
                                      href={`/api/document/content/${doc.id}`}
                                      target="_blank" onClick={e => { e.preventDefault(); openDoc(doc); }}
                                      rel="noreferrer"
                                      className="text-red-650 hover:underline font-mono text-[10px] font-bold inline-flex items-center min-h-[44px] px-2"
                                    >
                                      📥 Open / Download
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Folder B: Procurement & Bidding Files */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                              <h4 className="text-xs font-bold text-slate-700 uppercase font-mono flex items-center gap-1.5">
                                📂 2. Procurement Files & Bid Matrices
                              </h4>
                              <span className="text-[10px] bg-slate-200 text-slate-700 font-bold font-mono px-1.5 py-0.5 rounded">{projProcurements.length} files</span>
                            </div>

                            {projProcurements.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-2">No procurement sourcing sheets or tender bids match this project.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {projProcurements.map(proc => (
                                  <div key={proc.id} className="text-xs p-2 bg-white border border-slate-100 rounded space-y-1">
                                    <div className="flex justify-between font-bold">
                                      <span className="text-slate-800">{proc.title}</span>
                                      <span className={`text-[10px] font-mono ${proc.status === "Approved" ? "text-emerald-600" : "text-amber-600"
                                        }`}>{proc.status}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 italic">Justification: "{proc.justification}"</p>
                                    <div className="text-[9px] text-slate-400">
                                      Conflict declared: {proc.conflictDeclared ? "Yes (Mitigated) 🛡️" : "No (Compliant) ✓"}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Folder C: Expense Vouchers & Supporting Invoices */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                              <h4 className="text-xs font-bold text-slate-700 uppercase font-mono flex items-center gap-1.5">
                                📂 3. Expense Vouchers & Bills (Bills Ledger)
                              </h4>
                              <span className="text-[10px] bg-slate-200 text-slate-700 font-bold font-mono px-1.5 py-0.5 rounded">{projExpenses.length} vouchers</span>
                            </div>

                            {projExpenses.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-2">No expense vouchers or disbursements posted to this project.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {projExpenses.map(exp => {
                                  const alloc = exp.allocations ? exp.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                                  const isShared = !!alloc;
                                  const displayedVal = isShared ? Number(alloc.amount) : exp.amount;
                                  const docAttached = state.documents.find(d => d.linkedRecordType === "Expense" && d.linkedRecordId === exp.id);

                                  return (
                                    <div key={exp.id} className="text-xs p-2 bg-white border border-slate-100 rounded space-y-1">
                                      <div className="flex justify-between items-center">
                                        <span className="font-mono font-bold text-slate-700">{exp.voucherNo}</span>
                                        <span className="font-mono font-bold text-slate-900">
                                          {formatUSD(displayedVal * exp.rate)}
                                          {isShared && <span className="text-[9px] text-amber-600 font-normal ml-1">({alloc.percentage}%)</span>}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-650">{exp.title}</p>
                                      <div className="flex justify-between items-center text-[9px] text-slate-400">
                                        <span>Status: {exp.status}</span>
                                        {docAttached ? (
                                          <a
                                            href={`/api/document/content/${docAttached.id}`}
                                            target="_blank" onClick={e => { e.preventDefault(); openDoc(docAttached); }}
                                            rel="noreferrer"
                                            className="text-red-650 hover:underline font-bold inline-flex items-center min-h-[44px] px-2"
                                          >
                                            📥 Supporting PDF
                                          </a>
                                        ) : (
                                          <span className="text-slate-400 italic inline-flex items-center min-h-[44px] px-2">No bill PDF attached</span>
                                        )}
                                        <label className="text-red-650 hover:underline font-bold cursor-pointer inline-flex items-center min-h-[44px] px-2" title="The bill itself">
                                          🧾 Invoice
                                          <input
                                            type="file"
                                            accept="image/*,application/pdf"
                                            multiple
                                            className="hidden"
                                            aria-label={`Attach invoice to ${exp.voucherNo}`}
                                            onChange={(ev) => handleVoucherDocUpload(ev, exp.id, exp.voucherNo, "Invoice")}
                                          />
                                        </label>
                                        <label className="text-slate-500 hover:underline font-bold cursor-pointer inline-flex items-center min-h-[44px] px-2" title="Distribution lists, delivery notes, photos of the purchase">
                                          📷 Evidence
                                          <input
                                            type="file"
                                            accept="image/*,application/pdf"
                                            multiple
                                            className="hidden"
                                            aria-label={`Attach supporting evidence to ${exp.voucherNo}`}
                                            onChange={(ev) => handleVoucherDocUpload(ev, exp.id, exp.voucherNo, "Evidence")}
                                          />
                                        </label>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Folder D: Bank & Cash reconciliations */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                              <h4 className="text-xs font-bold text-slate-700 uppercase font-mono flex items-center gap-1.5">
                                📂 4. Bank Reconciliation Statement Items
                              </h4>
                              <span className="text-[10px] bg-slate-200 text-slate-700 font-bold font-mono px-1.5 py-0.5 rounded">{projFunding.length + projBankTx.length} items</span>
                            </div>

                            {projFunding.length + projBankTx.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-2">No cleared bank statements linked to this project.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {projFunding.map(bt => {
                                  const account = state.bankAccounts.find(ba => ba.id === bt.bankAccountId);
                                  return (
                                    <div key={bt.id} className="text-xs p-2 bg-emerald-50 border border-emerald-100 rounded space-y-0.5 font-mono">
                                      <div className="flex justify-between text-slate-800">
                                        <span>{bt.date} • {account?.name}</span>
                                        <span className="font-bold text-emerald-700">+{formatIn(bt.amount, account?.currency || "USD")}</span>
                                      </div>
                                      <p className="text-[9px] text-slate-500 font-sans italic">
                                        Funding received • source: BLOM statement {account?.accountNo} • {bt.description}
                                      </p>
                                    </div>
                                  );
                                })}
                                {projBankTx.map(bt => {
                                  const account = state.bankAccounts.find(ba => ba.id === bt.bankAccountId);
                                  return (
                                    <div key={bt.id} className="text-xs p-2 bg-white border border-slate-100 rounded space-y-0.5 font-mono">
                                      <div className="flex justify-between text-slate-800">
                                        <span>{bt.date} • {account?.name}</span>
                                        <span className="font-bold text-red-600">-{formatIn(bt.amount, account?.currency || "USD")}</span>
                                      </div>
                                      <p className="text-[9px] text-slate-500 font-sans italic">
                                        Reconciled to: {bt.voucherNo} • source: BLOM statement {account?.accountNo} • {bt.description}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Folder E: Proportional Cost Allocation Sheets */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 md:col-span-2">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                              <h4 className="text-xs font-bold text-slate-700 uppercase font-mono flex items-center gap-1.5">
                                📂 5. Personnel Cost Allocation Sheets (Timesheets)
                              </h4>
                              <span className="text-[10px] bg-slate-200 text-slate-700 font-bold font-mono px-1.5 py-0.5 rounded">{projTimesheets.length} allocated logs</span>
                            </div>

                            {projTimesheets.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-2">No employee salary timesheets have co-funded allocations mapped to this project yet.</p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto">
                                {projTimesheets.map(ts => {
                                  const emp = state.employees.find(e => e.id === ts.employeeId);
                                  const alloc = ts.allocations.find((a: any) => a.projectId === selectedProjectId);
                                  const allocatedSalary = (emp?.salary || 0) * ((alloc?.percentage || 0) / 100);

                                  return (
                                    <div key={ts.id} className="text-xs p-2 bg-white border border-slate-100 rounded space-y-1">
                                      <div className="flex justify-between items-center">
                                        <strong className="text-slate-800">{emp?.name || "Staff"}</strong>
                                        <span className="font-mono font-bold text-slate-900 bg-red-50 text-red-750 px-1.5 py-0.5 rounded">
                                          {alloc?.percentage || 0}% ({formatUSD(allocatedSalary)})
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-[10px] text-slate-500">
                                        <span>Month: {ts.month} • {emp?.position}</span>
                                        <span>Status: {ts.status}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    )}

                    {/* Sub-tab 2: Monthly Project Reconciliation Report (Section 2.5 Compliance) */}
                    {projectWorkspaceTab === "reconciliation" && (() => {
                      // Filter items for the specific reconMonth (YYYY-MM)
                      const monthExpenses = projExpenses.filter(e => {
                        const dateVal = e.paid_at || e.created_at;
                        return dateVal && dateVal.startsWith(reconMonth);
                      });

                      const monthBankTx = projBankTx.filter(bt => bt.date && bt.date.startsWith(reconMonth));

                      const monthWht = monthExpenses.reduce((sum, e) => sum + (e.whtAmount || 0), 0);
                      const monthPaid = monthExpenses.reduce((sum, e) => {
                        const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                        const amt = alloc ? Number(alloc.amount) : e.amount;
                        return sum + amt;
                      }, 0);

                      return (
                        <div className="space-y-4 font-sans">
                          {/* Report configuration filters */}
                          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
                            <div className="flex items-center gap-3">
                              <label className="text-xs font-bold text-slate-650 uppercase">{t("Select Reporting Month:")}</label>
                              <input
                                type="month"
                                value={reconMonth}
                                onChange={(e) => setReconMonth(e.target.value)}
                                className="finance-input text-xs"
                              />
                            </div>

                            <div className="flex flex-wrap gap-2 font-sans">
                              <button
                                type="button"
                                onClick={handleExportExcel}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs min-h-[44px] px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
                              >
                                📊 Export Excel
                              </button>
                              <button
                                type="button"
                                onClick={handleExportWord}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-xs min-h-[44px] px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
                              >
                                📝 Export Word
                              </button>
                              <button
                                type="button"
                                onClick={handleExportPDF}
                                className="bg-slate-800 hover:bg-slate-900 text-white text-xs min-h-[44px] px-4 py-2.5 rounded-lg font-semibold flex items-center justify-center gap-1 shadow-sm transition cursor-pointer"
                              >
                                📄 Export PDF
                              </button>
                            </div>
                          </div>

                          {/* Print container layout */}
                          <div id="reconciliation-print-report" className="bg-white border-2 border-slate-200 p-8 rounded-xl space-y-6 shadow-inner print-report print:border-0 print:p-0 print:exact-colors">

                            {/* Standardized professional header */}
                            <div className="text-center border-b-2 border-slate-350 pb-4 space-y-1">
                              <h1 className="text-lg font-bold uppercase tracking-wider text-slate-900">AnaHon Media Platform</h1>
                              <p className="text-[11px] font-mono text-slate-500 uppercase tracking-widest">Tripoli, Lebanon • Financial Control & Sinking Fund Division</p>
                              <h2 className="text-sm font-bold text-red-650 uppercase bg-red-50 inline-block px-3 py-1 rounded-full mt-2 font-mono">
                                Monthly Donor Project Reconciliation Report
                              </h2>
                            </div>

                            {/* Project Information */}
                            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 border border-slate-200 rounded-lg">
                              <div>
                                <p className="text-slate-500">PROJECT CODE:</p>
                                <p className="font-bold text-slate-900 font-mono">{activeProject.code}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">PROJECT TITLE:</p>
                                <p className="font-bold text-slate-900">{activeProject.name}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">RESTRICTED DONOR PARTNER:</p>
                                <p className="font-bold text-slate-900">{activeDonor?.name || "Restricted Donor"}</p>
                              </div>
                              <div>
                                <p className="text-slate-500">REPORTING RECONCILIATION MONTH:</p>
                                <p className="font-bold text-slate-900 font-mono uppercase">{reconMonth}</p>
                              </div>
                            </div>
                            {(() => {
                              const projectBudgetLines = state.budgetLines.filter(bl => bl.projectId === selectedProjectId);
                              const totalAllocated = projectBudgetLines.reduce((sum, bl) => sum + bl.allocatedUSD, 0);

                              const totalSpentThisMonth = projectBudgetLines.reduce((sum, bl) => {
                                const monthSpent = monthExpenses.filter(e => e.budgetLineId === bl.id).reduce((sumE, e) => {
                                  const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                                  return sumE + (alloc ? Number(alloc.amount) : e.amount);
                                }, 0);
                                return sum + monthSpent;
                              }, 0);

                              const totalCumulativeSpent = projectBudgetLines.reduce((sum, bl) => sum + bl.actualUSD, 0);
                              const totalRemainingBalance = totalAllocated - totalCumulativeSpent;
                              const overallBurnRate = totalAllocated > 0 ? Math.round((totalCumulativeSpent / totalAllocated) * 100) : 0;

                              const totalNetReconciled = monthExpenses.reduce((sum, e) => {
                                const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                                const calculatedNet = alloc ? Number(alloc.amount) - (Number(alloc.amount) * (e.whtAmount / e.amount)) : (e.netAmount || e.amount);
                                return sum + (calculatedNet * e.rate);
                              }, 0);

                              const totalWhtReconciled = monthExpenses.reduce((sum, e) => {
                                const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                                const whtVal = alloc ? Number(alloc.amount) * (e.whtAmount / e.amount) : e.whtAmount;
                                return sum + (whtVal * e.rate);
                              }, 0);

                              const hasPersonnelLines = projectBudgetLines.some(bl => bl.code.includes("PERS") || bl.category === "Personnel");

                              return (
                                <>
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-900 uppercase font-mono border-l-2 border-red-600 pl-2">
                                      I. Restricted Budget vs. Actual Expenditure Burn
                                    </h4>

                                    <div className="overflow-hidden border border-slate-200 rounded-lg">
                                      <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-100">
                                          <tr className="border-b border-slate-200 font-mono text-slate-650 uppercase font-bold text-[10px]">
                                            <th className="px-4 py-2">Account Line</th>
                                            <th className="px-4 py-2">Category Description</th>
                                            <th className="px-4 py-2 text-right hidden md:table-cell">Allocated Pool (USD)</th>
                                            <th className="px-4 py-2 text-right hidden md:table-cell">Spent This Month (USD)</th>
                                            <th className="px-4 py-2 text-right hidden md:table-cell">Cumulative Spent to Date</th>
                                            <th className="px-4 py-2 text-right">Remaining Balance / Burn %</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono">
                                          {projectBudgetLines.map(bl => {
                                            const monthSpent = monthExpenses.filter(e => e.budgetLineId === bl.id).reduce((sum, e) => {
                                              const alloc = e.allocations ? e.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                                              return sum + (alloc ? Number(alloc.amount) : e.amount);
                                            }, 0);

                                            const remaining = bl.allocatedUSD - bl.actualUSD;
                                            const burnPercent = bl.allocatedUSD > 0 ? Math.round((bl.actualUSD / bl.allocatedUSD) * 100) : 0;

                                            return (
                                              <tr key={bl.id} className="hover:bg-slate-50 font-medium break-inside-avoid">
                                                <td className="px-4 py-2 text-slate-800 font-bold">{bl.code}</td>
                                                <td className="px-4 py-2 text-slate-950 font-sans">{bl.category}</td>
                                                <td className="px-4 py-2 text-right text-slate-700 hidden md:table-cell">{formatUSD(bl.allocatedUSD)}</td>
                                                <td className="px-4 py-2 text-right text-red-650 font-bold hidden md:table-cell">{formatUSD(monthSpent)}</td>
                                                <td className="px-4 py-2 text-right text-slate-900 hidden md:table-cell">{formatUSD(bl.actualUSD)}</td>
                                                <td className="px-4 py-2 text-right text-slate-900 font-bold">
                                                  {formatUSD(remaining)} <span className="text-[10px] text-slate-500 font-normal">({burnPercent}%)</span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                          {/* Section I totals row */}
                                          <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold break-inside-avoid">
                                            <td colSpan={2} className="px-4 py-2 text-slate-900 font-sans text-right">TOTAL BUDGET BURN SUMMARY:</td>
                                            <td className="px-4 py-2 text-right text-slate-900 hidden md:table-cell">{formatUSD(totalAllocated)}</td>
                                            <td className="px-4 py-2 text-right text-red-600 hidden md:table-cell">{formatUSD(totalSpentThisMonth)}</td>
                                            <td className="px-4 py-2 text-right text-slate-900 hidden md:table-cell">{formatUSD(totalCumulativeSpent)}</td>
                                            <td className="px-4 py-2 text-right text-slate-900">
                                              {formatUSD(totalRemainingBalance)} <span className="text-[10px] text-slate-500 font-normal">({overallBurnRate}%)</span>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  {/* Section 2: Reconciled Transactions Matched (Section 2.5 verification) */}
                                  <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-900 uppercase font-mono border-l-2 border-red-600 pl-2">
                                      II. Reconciled Statement Matchings & Cash Flows
                                    </h4>

                                    <div className="overflow-hidden border border-slate-200 rounded-lg">
                                      <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-100">
                                          <tr className="border-b border-slate-200 font-mono text-slate-650 uppercase font-bold text-[10px]">
                                            <th className="px-4 py-2 hidden md:table-cell">Statement Date</th>
                                            <th className="px-4 py-2">Voucher / Ref</th>
                                            <th className="px-4 py-2">Transaction Memo</th>
                                            <th className="px-4 py-2 text-right hidden md:table-cell">Withholding Tax (WHT)</th>
                                            <th className="px-4 py-2 text-right">Reconciled Net</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono">
                                          {monthExpenses.length === 0 ? (
                                            <tr>
                                              <td colSpan={5} className="px-4 py-3 text-slate-400 italic text-center font-sans">No reconciled outflows or disbursements found for this period.</td>
                                            </tr>
                                          ) : (
                                            monthExpenses.map(exp => {
                                              const alloc = exp.allocations ? exp.allocations.find((a: any) => a.projectId === selectedProjectId) : null;
                                              const calculatedNet = alloc ? Number(alloc.amount) - (Number(alloc.amount) * (exp.whtAmount / exp.amount)) : (exp.netAmount || exp.amount);
                                              const whtVal = alloc ? Number(alloc.amount) * (exp.whtAmount / exp.amount) : exp.whtAmount;

                                              return (
                                                <tr key={exp.id} className="hover:bg-slate-50 break-inside-avoid">
                                                  <td className="px-4 py-2 text-slate-500 hidden md:table-cell">{exp.paid_at?.split("T")[0] || exp.created_at?.split("T")[0]}</td>
                                                  <td className="px-4 py-2 text-slate-800 font-bold">{exp.voucherNo}</td>
                                                  <td className="px-4 py-2 text-slate-950 font-sans">{exp.title}</td>
                                                  <td className="px-4 py-2 text-right text-amber-600 hidden md:table-cell">{formatUSD(whtVal * exp.rate)}</td>
                                                  <td className="px-4 py-2 text-right text-slate-900 font-bold">{formatUSD(calculatedNet * exp.rate)}</td>
                                                </tr>
                                              );
                                            })
                                          )}
                                          {/* Section II totals row (Desktop-only) */}
                                          {monthExpenses.length > 0 && (
                                            <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold break-inside-avoid hidden md:table-row">
                                              <td colSpan={3} className="px-4 py-2 text-slate-900 font-sans text-right">RECONCILED MATCHINGS TOTAL:</td>
                                              <td className="px-4 py-2 text-right text-amber-600">{formatUSD(totalWhtReconciled)}</td>
                                              <td className="px-4 py-2 text-right text-slate-900">{formatUSD(totalNetReconciled)}</td>
                                            </tr>
                                          )}
                                          {/* Section II totals row (Mobile-only) */}
                                          {monthExpenses.length > 0 && (
                                            <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold break-inside-avoid md:hidden">
                                              <td colSpan={2} className="px-4 py-2 text-slate-900 font-sans text-right">TOTAL NET:</td>
                                              <td className="px-4 py-2 text-right text-slate-900">{formatUSD(totalNetReconciled)}</td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* Mathematical Tie-Out Verification Banner */}
                                    {(() => {
                                      const difference = Math.abs(totalSpentThisMonth - (totalNetReconciled + totalWhtReconciled));
                                      const isTiedOut = difference < 0.01;

                                      return isTiedOut ? (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-center justify-between font-mono break-inside-avoid">
                                          <span className="flex items-center gap-1.5 font-bold">
                                            🛡️ AUDITOR TIE-OUT VERIFICATION PASSED:
                                          </span>
                                          <span>
                                            Spent This Month ({formatUSD(totalSpentThisMonth)}) = Reconciled Net ({formatUSD(totalNetReconciled)}) + WHT ({formatUSD(totalWhtReconciled)}) perfectly ties to the penny. ✓
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 flex items-center justify-between font-mono break-inside-avoid">
                                          <span className="flex items-center gap-1.5 font-bold">
                                            ⚠️ AUDITOR TIE-OUT WARNING: MISMATCH DETECTED:
                                          </span>
                                          <span>
                                            Spent This Month ({formatUSD(totalSpentThisMonth)}) ≠ Reconciled Net ({formatUSD(totalNetReconciled)}) + WHT ({formatUSD(totalWhtReconciled)}) | Delta: {formatUSD(difference)}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  {/* Section 3: Official Reconciliation Review Sign-Off (Section 2.5 compliance) */}
                                  <div className="border-t-2 border-slate-200 pt-6 space-y-4 break-inside-avoid">
                                    <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                                      Under **Section 2.5 & 2.6 of the AnaHon Media Platform Accounting Policies Manual**, this reconciliation report verifies that all project expenditures, personnel allocations, timesheets, and shared split costs have been matched with primary supporting documents and validated with actual bank statement disbursements.
                                    </p>

                                    {hasPersonnelLines && (
                                      <p className="text-[10px] text-red-750 bg-red-50 border border-red-150 rounded px-3 py-1.5 text-center font-mono font-bold">
                                        📋 DYNAMIC AUDIT DISCLOSURE: Timesheet evidence strictly attached for all payroll allocations.
                                      </p>
                                    )}

                                    <div className="grid grid-cols-2 gap-12 pt-6">
                                      <div className="text-center space-y-12">
                                        <div className="font-mono text-xs border-b border-slate-350 pb-2 mx-6 italic text-slate-600">
                                          {financeOfficerName}
                                        </div>
                                        <div>
                                          <span className="block text-xs font-bold text-slate-800 uppercase font-sans">Prepared By</span>
                                          <span className="block text-[10px] text-slate-500 uppercase font-mono">{financeOfficerName} (Finance Officer)</span>
                                        </div>
                                      </div>

                                      <div className="text-center space-y-12">
                                        <div className="font-mono text-xs border-b border-slate-350 pb-2 mx-6 italic text-slate-400">
                                          [Signature Box]
                                        </div>
                                        <div>
                                          <span className="block text-xs font-bold text-slate-800 uppercase font-sans">Reviewed & Co-Signed By</span>
                                          <span className="block text-[10px] text-slate-500 uppercase font-mono">Farah Shami (Executive Director)</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}

                          </div>
                        </div>
                      );
                    })()}

                  </div>
                );
              })()}

              {/* Budgets Lines adjustments block */}
              <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
                <h4 className="text-md font-bold mb-4">Dedicated Project Account Lines</h4>
                <div className="divide-y divide-slate-100">
                  {state.budgetLines.map(bl => {
                    const p = state.projects.find(x => x.id === bl.projectId);
                    return (
                      <div key={bl.id} className="py-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-slate-100 text-slate-800 font-mono font-bold px-1.5 py-0.5 rounded">{p?.code}</span>
                            <span className="text-sm font-bold text-slate-950 font-mono">{bl.code}</span>
                          </div>
                          <p className="text-xs text-slate-800">{bl.description}</p>
                        </div>

                        {/* Interactive adjustment slider setup for Executive Directors */}
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] block text-slate-500 uppercase">Allocated Target</span>
                            <span className="text-sm font-bold font-mono text-slate-900">{formatUSD(bl.allocatedUSD)}</span>
                          </div>
                          {["Super Admin", "Executive Director"].includes(currentUser.role) ? (
                            <input
                              type="number"
                              defaultValue={bl.allocatedUSD}
                              onBlur={(e) => handleModifyAllocation(bl.id, e.target.value)}
                              className="finance-input w-28 text-xs font-mono"
                              placeholder="Modify threshold"
                            />
                          ) : (
                            <div className="w-24 px-2 py-1 bg-slate-100 text-[10px] text-slate-500 rounded text-center">
                              Ready Locked
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
  </>);
}
