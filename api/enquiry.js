// Vercel serverless function — qualifies an enquiry, emails the team a
// tagged internal notification, and emails the enquirer a tailored auto-reply.
// Local dev: served by serve.mjs, which imports this same module.

const FROM = 'Nua Modular <contact@nuamodular.com>';
const TO = 'contact@nuamodular.com';

const LABELS = {
  enquiry_type: {
    single: 'Single unit — own back garden',
    multi: 'Multi-unit development (Airbnb / glamping village)',
  },
  product_interest: {
    ultra: 'Nua Ultra (€70,000)',
    not_sure: 'Not sure yet',
  },
  budget: {
    under_40k: 'Under €40k',
    '40_55k': '€40k–55k',
    '55_70k': '€55k–70k',
    '70k_plus': '€70k+',
    prefer_not_say: 'Prefer not to say',
  },
  own_site: {
    own_land: 'Yes, own the land',
    searching: 'Currently searching for land',
    no_land: 'No land yet',
  },
  truck_access: {
    clear: 'Yes, clear access for a truck/crane',
    not_sure: 'Not sure',
    tight: 'No, access looks tight',
  },
  trees_powerlines: {
    no: 'No trees or overhead lines near the site',
    yes: 'Yes, there are trees or overhead lines',
    not_sure: 'Not sure',
  },
  side_access: {
    yes: 'Yes, separate side access (not through the house)',
    no: 'No, only through the house',
    not_sure: 'Not sure',
  },
  timeline: {
    now: 'Ready to move now',
    '3_6': '3–6 months',
    '6_12': '6–12 months',
    researching: 'Just researching',
  },
};

function label(field, value) {
  return (LABELS[field] && LABELS[field][value]) || value || '—';
}

function scoreEnquiry(fields) {
  const productInterest = fields.product_interest || 'not_sure';
  const budget = fields.budget || 'prefer_not_say';
  const ownSite = fields.own_site || '';
  const truckAccess = fields.truck_access || 'not_sure';
  const treesPowerlines = fields.trees_powerlines || 'not_sure';
  const sideAccess = fields.side_access || 'not_sure';
  const timeline = fields.timeline || 'researching';

  let budgetPts;
  if (budget === 'prefer_not_say') {
    budgetPts = 15;
  } else if (productInterest === 'ultra') {
    budgetPts = { '70k_plus': 30, '55_70k': 20, '40_55k': 10, under_40k: 5 }[budget] ?? 10;
  } else {
    budgetPts = budget === 'under_40k' ? 5 : 20;
  }

  const sitePts = { own_land: 20, searching: 10, no_land: 0 }[ownSite] ?? 5;
  const truckPts = { clear: 20, not_sure: 10, tight: 0 }[truckAccess] ?? 10;
  const treesPts = { no: 15, not_sure: 8, yes: 0 }[treesPowerlines] ?? 8;
  const sidePts = { yes: 10, not_sure: 5, no: 0 }[sideAccess] ?? 5;
  const timelinePts = { now: 5, '3_6': 4, '6_12': 2, researching: 0 }[timeline] ?? 0;

  const score = budgetPts + sitePts + truckPts + treesPts + sidePts + timelinePts;

  let primaryTag;
  if (score >= 75) primaryTag = 'HOT';
  else if (score >= 50) primaryTag = 'WARM';
  else if (score >= 25) primaryTag = 'NURTURE';
  else primaryTag = 'COLD';

  const siteVisitNeeded = treesPowerlines === 'yes' || truckAccess === 'tight';
  const isCommercial = fields.enquiry_type === 'multi';

  return { score, primaryTag, siteVisitNeeded, isCommercial };
}

function buildTagLine(primaryTag, siteVisitNeeded, isCommercial) {
  const parts = [];
  if (isCommercial) parts.push('COMMERCIAL');
  parts.push(primaryTag);
  if (siteVisitNeeded) parts.push('SITE VISIT NEEDED');
  return parts.join(' + ');
}

const TEMPLATES = {
  COMMERCIAL: (name) =>
    `Hi ${name},\n\nThanks for getting in touch about a multi-unit project — developments like this (Airbnb, glamping villages and the like) are exactly the kind of work we enjoy. Site layout, access and numbers all matter a lot more at this scale, so I'll follow up personally to talk through the details and arrange a site visit.\n\nThe Nua Modular team`,
  HOT: (name) =>
    `Hi ${name},\n\nThanks for getting in touch about the Nua Ultra — sounds like a great fit. I'll give you a call within the next few hours to talk through next steps. In the meantime, feel free to reply here with a few days that suit if you'd like to get ahead of it.\n\nThe Nua Modular team`,
  WARM: (name) =>
    `Hi ${name},\n\nThanks for the enquiry — really appreciate the detail. A couple of things I'd like to talk through before we go further (mainly around the site itself), so I'll follow up by phone or email shortly. If it's easier for you, feel free to reply here with more on access to the site or your timeline.\n\nThe Nua Modular team`,
  SITE_VISIT: (name) =>
    `Hi ${name},\n\nThanks for reaching out. From what you've described, the site itself — trees, overhead lines, or access for delivery — will need a proper look before we can confirm feasibility. That's completely normal, plenty of sites need this. I'll follow up to arrange a call or a site visit.\n\nThe Nua Modular team`,
  NURTURE: (name) =>
    `Hi ${name},\n\nThanks for your interest in Nua Modular. Sounds like you're still in the early stages, which is no problem at all. I'll send over some more detail on the Ultra so you've got it to hand when you're ready to move forward.\n\nThe Nua Modular team`,
  COLD: (name) =>
    `Hi ${name},\n\nThanks for getting in touch. Based on what you've shared, it doesn't sound like a strong fit right now — but happy to stay in touch if anything changes on your end.\n\nThe Nua Modular team`,
};

function buildAutoReply(name, primaryTag, siteVisitNeeded, isCommercial) {
  const firstName = (name || 'there').trim().split(/\s+/)[0];
  const key = isCommercial ? 'COMMERCIAL' : siteVisitNeeded ? 'SITE_VISIT' : primaryTag;
  return TEMPLATES[key](firstName);
}

function buildInternalEmail(fields, score, primaryTag, siteVisitNeeded, isCommercial) {
  const tagLine = buildTagLine(primaryTag, siteVisitNeeded, isCommercial);
  const lines = [
    `SCORE: ${score}/100`,
    `TAG: ${tagLine}`,
    '',
    `Looking for: ${label('enquiry_type', fields.enquiry_type)}`,
    '',
    '— Contact —',
    `Name: ${fields.name || '—'}`,
    `Email: ${fields.email || '—'}`,
    `Phone: ${fields.phone || '—'}`,
    `Eircode: ${fields.eircode || '—'}`,
    '',
    '— Product & Budget —',
    `Product interest: ${label('product_interest', fields.product_interest)}`,
    `Budget: ${label('budget', fields.budget)}`,
    '',
    '— Site Logistics —',
    `Own site: ${label('own_site', fields.own_site)}`,
    `Plot dimensions: ${fields.plot_dimensions || '—'}`,
    `Truck/crane access: ${label('truck_access', fields.truck_access)}`,
    `Trees / overhead lines: ${label('trees_powerlines', fields.trees_powerlines)}`,
    `Separate side access: ${label('side_access', fields.side_access)}`,
    '',
    '— Timeline —',
    `Timeline: ${label('timeline', fields.timeline)}`,
    '',
    '— Message —',
    fields.message || '—',
  ];
  return lines.join('\n');
}

async function sendEmail({ to, subject, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[enquiry] RESEND_API_KEY not set — skipping send. Would have sent:\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const fields = req.body || {};

  if (!fields.name || !fields.email) {
    res.status(400).json({ ok: false, error: 'Name and email are required.' });
    return;
  }

  const { score, primaryTag, siteVisitNeeded, isCommercial } = scoreEnquiry(fields);
  const tagLine = buildTagLine(primaryTag, siteVisitNeeded, isCommercial);

  try {
    await sendEmail({
      to: TO,
      subject: `[LEAD: ${tagLine}, ${score}/100] ${fields.name} — ${label('product_interest', fields.product_interest)}`,
      text: buildInternalEmail(fields, score, primaryTag, siteVisitNeeded, isCommercial),
    });

    await sendEmail({
      to: fields.email,
      subject: 'Thanks for your enquiry — Nua Modular',
      text: buildAutoReply(fields.name, primaryTag, siteVisitNeeded, isCommercial),
    });

    res.status(200).json({ ok: true, score, tag: tagLine });
  } catch (err) {
    console.error('[enquiry] send failed', err);
    res.status(502).json({ ok: false, error: 'Could not send email.' });
  }
}
