import{a as D,r as h,j as e,A as B,ar as U,n as g,as as _}from"./index-grL27em3.js";import{c as b}from"./pii-BcFV6mqh.js";function u(a){if(!a)return"";const l=a instanceof Date?a:new Date(a);return Number.isNaN(l.getTime())?String(a):l.toLocaleString()}function O(a,l){const p=new Blob([JSON.stringify(l,null,2)],{type:"application/json"}),m=URL.createObjectURL(p),c=document.createElement("a");c.href=m,c.download=a,document.body.appendChild(c),c.click(),c.remove(),URL.revokeObjectURL(m)}function r(a){return String(a).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}function F(a){const l=window.open("","_blank","noopener,noreferrer");if(!l){g.error("Popup blocked");return}const p=Array.isArray(a.logs)?a.logs:[],m=b(a)||a.candidateId,c=p.map(i=>`<tr>
          <td>${r(u(i.at))}</td>
          <td>${r(i.stageTag)}</td>
          <td>${r(i.remark)}</td>
          <td>${r(i.actorRole)}</td>
          <td>${r(i.actorUserId)}</td>
          <td>${r(i.rejectionType)}</td>
          <td>${r(i.autoRejectCode)}</td>
        </tr>`).join("");l.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Rejection Log - ${r(a.candidateId)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 18px; }
    h2 { margin: 0 0 6px; }
    .small { color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; vertical-align: top; }
    th { background: #f6f6f6; text-align: left; }
  </style>
</head>
<body>
  <h2>Rejection Log</h2>
  <div class="small">Candidate: ${r(m)} (${r(a.candidateId)})</div>
  <div class="small">Requirement: ${r(a.requirementId)} ${a.jobTitle?`· ${r(a.jobTitle)}`:""}</div>
  <div class="small">Role: ${r(a.jobRole)} · Source: ${r(a.source)}</div>
  <div class="small">Rejected At: ${r(u(a.rejectedAt))}</div>
  <div class="small">Rejected From: ${r(a.rejectedFromStatus)} · Reason: ${r(a.rejectedReasonCode)}</div>
  <div class="small">Rejected Stage: ${r(a.rejectedStageTag)} · Remark: ${r(a.rejectedRemark)}</div>

  <table>
    <thead>
      <tr>
        <th>At</th>
        <th>Stage</th>
        <th>Remark</th>
        <th>Actor Role</th>
        <th>Actor User</th>
        <th>Type</th>
        <th>Auto Code</th>
      </tr>
    </thead>
    <tbody>
      ${c||'<tr><td colspan="7">No logs</td></tr>'}
    </tbody>
  </table>

  <script>window.print();<\/script>
</body>
</html>`),l.document.close()}function P(){const{token:a,role:l,legacyRole:p,canPortal:m,canAction:c}=D();function i(t,s){const n=typeof m=="function"?m(t):null;if(n===!0||n===!1)return n;const o=String(p||l||"").toUpperCase();return Array.isArray(s)?s.includes(o):!1}function N(t,s){const n=typeof c=="function"?c(t):null;if(n===!0||n===!1)return n;const o=String(p||l||"").toUpperCase();return Array.isArray(s)?s.includes(o):!1}const x=i("PORTAL_REJECTION_LOG",["HR","EA","ADMIN"]),j=x&&N("REJECTION_LOG_LIST",["HR","EA","ADMIN"]),y=x&&N("REJECT_REVERT",["ADMIN"]),[I,$]=h.useState(!1),[f,w]=h.useState([]),[v,C]=h.useState(""),[L,k]=h.useState({}),[T,S]=h.useState("");async function A(){if(j){$(!0);try{const t=await U(a);w(t.items??[])}catch(t){g.error((t==null?void 0:t.message)||"Failed to load")}finally{$(!1)}}}h.useEffect(()=>{A()},[j]);const R=h.useMemo(()=>{const t=String(v||"").trim().toLowerCase();return t?f.filter(s=>[s.candidateId,s.requirementId,s.candidateName,s.candidateNameFull,s.mobile,s.mobileFull,s.jobRole,s.jobTitle,s.rejectedReasonCode,s.rejectedStageTag].filter(Boolean).join(" · ").toLowerCase().includes(t)):f},[f,v]);function E(t){const s=`${t.candidateId}|${t.requirementId}`;k(n=>({...n,[s]:!n[s]}))}async function q(t){if(!y){g.error("Not allowed");return}const s=window.prompt("Revert remark (optional):","");if(s==null)return;const n=`${t.candidateId}|${t.requirementId}:REVERT`;S(n);try{await _(a,{requirementId:t.requirementId,candidateId:t.candidateId,remark:String(s||"").trim()}),g.success("Reverted"),w(o=>o.filter(d=>!(d.candidateId===t.candidateId&&d.requirementId===t.requirementId)))}catch(o){g.error((o==null?void 0:o.message)||"Failed")}finally{S("")}}return e.jsxs(B,{children:[x?j?null:e.jsxs("div",{className:"card",style:{padding:12,marginBottom:12},children:[e.jsx("div",{style:{fontWeight:700},children:"Not allowed"}),e.jsx("div",{className:"small",style:{color:"var(--gray-600)"},children:"You don’t have permission to load Rejection Log."})]}):e.jsxs("div",{className:"card",style:{padding:12,marginBottom:12},children:[e.jsx("div",{style:{fontWeight:700},children:"Not allowed"}),e.jsx("div",{className:"small",style:{color:"var(--gray-600)"},children:"You don’t have access to Rejection Log portal."})]}),e.jsxs("div",{style:{marginBottom:"20px"},children:[e.jsx("h1",{className:"page-title",children:"Rejection Log"}),e.jsx("p",{className:"page-subtitle",children:y?"View all rejected candidates. You can revert rejections.":"View all rejected candidates (read-only)."})]}),e.jsx("div",{className:"card",style:{marginBottom:"16px"},children:e.jsxs("div",{className:"row",style:{gap:12,alignItems:"center",flexWrap:"wrap"},children:[e.jsx("div",{style:{flex:1,minWidth:"280px"},children:e.jsx("input",{value:v,onChange:t=>C(t.target.value),placeholder:"🔍 Search by Name, ID, Stage...",style:{width:"100%"}})}),e.jsx("button",{className:"button",type:"button",onClick:A,disabled:I||!j,children:I?"Loading…":"↻ Refresh"}),e.jsxs("span",{className:"badge gray",children:[R.length," candidates"]})]})}),R.length===0?e.jsxs("div",{className:"card",style:{textAlign:"center",padding:"40px"},children:[e.jsx("div",{style:{fontSize:"48px",marginBottom:"12px"},children:"📭"}),e.jsx("p",{className:"small",children:"No rejected candidates found."})]}):e.jsx("div",{style:{display:"grid",gridTemplateColumns:"1fr",gap:12},children:R.map(t=>{const s=`${t.candidateId}|${t.requirementId}`,n=!!L[s],o=Array.isArray(t.logs)?t.logs:[];return e.jsxs("div",{className:"card",children:[e.jsxs("div",{className:"row",style:{justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"flex-start"},children:[e.jsxs("div",{style:{flex:1},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"},children:[e.jsxs("div",{style:{fontWeight:600,fontSize:"16px"},children:[b(t)||t.candidateId,b(t)&&t.candidateId?e.jsxs("span",{className:"small",style:{fontWeight:400,marginLeft:8,color:"var(--gray-500)"},children:["(",t.candidateId,")"]}):null]}),e.jsx("span",{className:"badge red",children:t.rejectedStageTag||"REJECTED"})]}),e.jsxs("div",{className:"small",style:{display:"grid",gap:"4px"},children:[e.jsxs("div",{children:[e.jsx("strong",{children:"Position:"})," ",t.jobTitle?`${t.jobTitle} · `:"",t.jobRole]}),e.jsxs("div",{children:[e.jsx("strong",{children:"IDs:"})," ",t.candidateId," / ",t.requirementId]}),e.jsxs("div",{children:[e.jsx("strong",{children:"Rejected:"})," ",u(t.rejectedAt)||"—"," ",t.rejectedFromStatus?`(from ${t.rejectedFromStatus})`:""]}),t.rejectedRemark&&e.jsxs("div",{children:[e.jsx("strong",{children:"Remark:"})," ",t.rejectedRemark]})]})]}),e.jsxs("div",{style:{display:"flex",gap:8,flexWrap:"wrap"},children:[e.jsx("button",{className:"button sm",type:"button",onClick:()=>E(t),children:n?"▲ Hide":"▼ Logs"}),e.jsx("button",{className:"button sm",type:"button",onClick:()=>O(`rejection_${t.candidateId}_${t.requirementId}.json`,t),children:"⬇ JSON"}),e.jsx("button",{className:"button sm",type:"button",onClick:()=>F(t),children:"🖨 Print"}),y&&e.jsx("button",{className:"button sm danger",type:"button",onClick:()=>q(t),disabled:T===`${s}:REVERT`,children:T===`${s}:REVERT`?"...":"↩ Revert"})]})]}),n&&e.jsxs("div",{style:{marginTop:16,borderTop:"1px solid var(--gray-100)",paddingTop:16},children:[e.jsxs("div",{className:"section-title",style:{fontSize:"14px"},children:["📋 Rejection History (",o.length,")"]}),o.length===0?e.jsx("div",{className:"small",children:"No detailed logs available."}):e.jsx("div",{style:{overflowX:"auto"},children:e.jsxs("table",{children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"Date/Time"}),e.jsx("th",{children:"Stage"}),e.jsx("th",{children:"Remark"}),e.jsx("th",{children:"Actor"}),e.jsx("th",{children:"Type"}),e.jsx("th",{children:"Code"})]})}),e.jsx("tbody",{children:o.map(d=>e.jsxs("tr",{children:[e.jsx("td",{style:{whiteSpace:"nowrap"},children:u(d.at)}),e.jsx("td",{children:e.jsx("span",{className:"badge orange",children:d.stageTag})}),e.jsx("td",{children:d.remark||"—"}),e.jsx("td",{children:`${d.actorRole||""}${d.actorUserId?` (${d.actorUserId})`:""}`}),e.jsx("td",{children:d.rejectionType||"—"}),e.jsx("td",{children:d.autoRejectCode||"—"})]},d.logId||`${d.at}-${d.stageTag}`))})]})})]})]},s)})})]})}export{P as RejectionLogPage};
