/**
 * Shoebox Submitter Metadata - Apps Script Web App
 * Google Sheet: Shoebox Submitter Metadata
 * Tabs: Submissions, Contributions
 *
 * DEPLOYMENT: Paste into script.google.com → New Project → Save
 * Then Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone
 *
 * SECURITY: Change ADMIN_TOKEN before deployment - it's a capability key for admin actions
 */

const SPREADSHEET_ID = '1DSu7arfh8xnQmYm7JIphImPjBhmeCrADAD8AOhpCy9g';
const ADMIN_TOKEN = 'RgTSsLmm7_PPxlzfL1Az0Q-bcSxu6O3vHMG8rDInuiw'; // secret admin capability key — keep out of public repos
const SHEET_SUBMISSIONS = 'Submissions';
const SHEET_CONTRIBUTIONS = 'Contributions';

// Notification recipients for new contributions (project lead + archive admin)
const NOTIFY_EMAILS = ['metisshoebox@mmf.mb.ca', 'bayard.devries@mmf.mb.ca'];

// Column indices for Submissions (0-based, matching header order)
const SUBMISSION_COLS = {
  submissionId: 0,
  event: 1,
  submitterName: 2,
  email: 3,
  phone: 4,
  familyName: 5,
  mmfNumber: 6,
  consentRef: 7,
  photoIds: 8,
  status: 9,
  token: 10,
  inviteSentAt: 11,
  notes: 12
};

// Column indices for Contributions (0-based)
const CONTRIB_COLS = {
  id: 0,
  submissionId: 1,
  photoId: 2,
  submittedAt: 3,
  people: 4,
  location: 5,
  community: 6,
  province: 7,
  country: 8,
  dateYear: 9,
  dateEra: 10,
  occasion: 11,
  story: 12,
  caption: 13,
  attribution: 14,
  keywords: 15,
  status: 16
};

function doGet(e) {
  const params = e.parameter || {};
  const action = params.action;
  const token = params.token;
  const admin_token = params.admin_token;

  try {
    if (!action) {
      return jsonResponse({ error: 'missing_action' }, 400);
    }

    // Admin actions (require admin_token)
    if (action === 'admin_list_submissions') {
      return handleAdminListSubmissions(admin_token);
    }
    if (action === 'admin_get_submission') {
      return handleAdminGetSubmission(params.id, admin_token);
    }
    if (action === 'admin_create_submission') {
      return handleAdminCreateSubmission({
        submissionId: params.submissionId,
        event: params.event,
        submitterName: params.submitterName,
        email: params.email,
        phone: params.phone,
        familyName: params.familyName,
        mmfNumber: params.mmfNumber,
        consentRef: params.consentRef
      }, admin_token);
    }
    if (action === 'admin_update_submission') {
      return handleAdminUpdateSubmission({
        id: params.id,
        photoIds: params.photoIds,
        status: params.status,
        email: params.email,
        invitedAt: params.invitedAt
      }, admin_token);
    }
    if (action === 'admin_list_contributions') {
      return handleAdminListContributions(admin_token);
    }
    if (action === 'admin_get_contribution') {
      return handleAdminGetContribution(params.id, admin_token);
    }
    if (action === 'admin_update_contribution') {
      return handleAdminUpdateContribution({ id: params.id, fields: params }, admin_token);
    }
    if (action === 'admin_delete_contribution') {
      return handleAdminDeleteContribution(params.id, admin_token);
    }

    // Submitter-facing actions
    if (action === 'submission') {
      return handleGetSubmission(token);
    }

    return jsonResponse({ error: 'invalid_action' }, 400);
  } catch (err) {
    return jsonResponse({ error: 'server_error', message: err.message }, 500);
  }
}

function doPost(e) {
  const contentType = e.contentType || '';

  try {
    // Parse form-encoded data
    const params = e.parameter || {};
    const token = params.token;
    const photoId = params.photoId;

    if (!token || !photoId) {
      return jsonResponse({ error: 'missing_required_fields', field: !token ? 'token' : 'photoId' }, 400);
    }

    // Verify submission exists for this token
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const submissions = ss.getSheetByName(SHEET_SUBMISSIONS);
    const submissionData = submissions.getDataRange().getValues();
    const headerRow = submissionData[0];
    
    let targetSubmission = null;
    for (let i = 1; i < submissionData.length; i++) {
      if (submissionData[i][SUBMISSION_COLS.token] === token) {
        targetSubmission = submissionData[i];
        break;
      }
    }

    if (!targetSubmission) {
      return jsonResponse({ error: 'invalid_token' }, 403);
    }

    const submissionId = targetSubmission[SUBMISSION_COLS.submissionId];
    const submittedAt = new Date().toISOString();

    // Build contribution row
    const row = [
      '', // id - will be set by Apps Script
      submissionId,
      photoId,
      submittedAt,
      params.people || '',
      params.location || '',
      params.community || '',
      params.province || '',
      params.country || '',
      params.dateYear || '',
      params.dateEra || '',
      params.occasion || '',
      params.story || '',
      params.caption || '',
      params.attribution || '',
      params.keywords || '',
      'pending' // status
    ];

    // Generate unique id
    const newId = Utilities.getUuid() + '-' + Utilities.getUuid().substring(0, 8);
    row[CONTRIB_COLS.id] = newId;

    // Append to Contributions sheet
    const contributions = ss.getSheetByName(SHEET_CONTRIBUTIONS);
    contributions.appendRow(row);

    // Notify the archive team that a submitter added details
    try {
      sendContributionNotification(submitterName(targetSubmission), submissionId, photoId, params, submittedAt);
    } catch (notifyErr) {
      // Notification failure must not block the submission itself
      console.warn('Contribution notification failed: ' + notifyErr.message);
    }

    return jsonResponse({ status: 'ok', contributionId: newId });
  } catch (err) {
    return jsonResponse({ error: 'server_error', message: err.message }, 500);
  }
}

// Internal handlers

function submitterName(row) {
  return (row[SUBMISSION_COLS.submitterName] || 'Unknown submitter').toString();
}

function sendContributionNotification(submitter, submissionId, photoId, params, submittedAt) {
  const people = params.people || '(not provided)';
  const story = params.story || '(not provided)';
  const location = params.location || params.community || '(not provided)';
  const caption = params.caption || '(not provided)';
  const occasion = params.occasion || '(not provided)';
  const dateYear = params.dateYear || '(not provided)';
  const era = params.dateEra || '(not provided)';

  const subject = 'New photo details submitted: ' + submitter + ' (' + submissionId + ')';
  const body =
    'A submitter just added details to one of their photos.\n\n' +
    'Submitter: ' + submitter + '\n' +
    'Submission: ' + submissionId + '\n' +
    'Photo ID: ' + photoId + '\n' +
    'Submitted at: ' + submittedAt + '\n\n' +
    'Details provided:\n' +
    '- People: ' + people + '\n' +
    '- Location: ' + location + '\n' +
    '- Year: ' + dateYear + '  Era: ' + era + '\n' +
    '- Occasion: ' + occasion + '\n' +
    '- Caption: ' + caption + '\n' +
    '- Story: ' + story + '\n\n' +
    'Review in the Contributions tab of the Shoebox Submitter Metadata sheet, ' +
    'then approve or edit before it merges into the archive.';

  for (var i = 0; i < NOTIFY_EMAILS.length; i++) {
    MailApp.sendEmail(NOTIFY_EMAILS[i], subject, body);
  }
}

function handleGetSubmission(token) {
  if (!token) {
    return jsonResponse({ error: 'missing_token' }, 400);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const submissions = ss.getSheetByName(SHEET_SUBMISSIONS);
  const contributions = ss.getSheetByName(SHEET_CONTRIBUTIONS);

  const submissionData = submissions.getDataRange().getValues();
  const headerRow = submissionData[0];

  let targetSubmission = null;
  let submissionRow = null;
  for (let i = 1; i < submissionData.length; i++) {
    if (submissionData[i][SUBMISSION_COLS.token] === token) {
      targetSubmission = submissionData[i];
      submissionRow = i;
      break;
    }
  }

  if (!targetSubmission) {
    return jsonResponse({ error: 'invalid_token' }, 403);
  }

  const submitterName = targetSubmission[SUBMISSION_COLS.submitterName] || 'Unknown';
  const photoIdsStr = targetSubmission[SUBMISSION_COLS.photoIds] || '';
  const photoIds = photoIdsStr ? photoIdsStr.split(',').map(id => id.trim()).filter(Boolean) : [];

  // Build photos array (src and title would come from manifest - here we use placeholders)
  const photos = photoIds.map(id => ({
    photoId: id,
    src: id, // In real app, this maps to manifest.json src
    title: id // In real app, this maps to manifest.json title
  }));

  // Get contributions for this submission
  const contribData = contributions.getDataRange().getValues();
  const contribRow = [];
  for (let i = 1; i < contribData.length; i++) {
    if (contribData[i][CONTRIB_COLS.submissionId] === targetSubmission[SUBMISSION_COLS.submissionId]) {
      contribRow.push({
        id: contribData[i][CONTRIB_COLS.id],
        photoId: contribData[i][CONTRIB_COLS.photoId],
        submittedAt: contribData[i][CONTRIB_COLS.submittedAt],
        people: contribData[i][CONTRIB_COLS.people],
        location: contribData[i][CONTRIB_COLS.location],
        community: contribData[i][CONTRIB_COLS.community],
        province: contribData[i][CONTRIB_COLS.province],
        country: contribData[i][CONTRIB_COLS.country],
        dateYear: contribData[i][CONTRIB_COLS.dateYear],
        dateEra: contribData[i][CONTRIB_COLS.dateEra],
        occasion: contribData[i][CONTRIB_COLS.occasion],
        story: contribData[i][CONTRIB_COLS.story],
        caption: contribData[i][CONTRIB_COLS.caption],
        attribution: contribData[i][CONTRIB_COLS.attribution],
        keywords: contribData[i][CONTRIB_COLS.keywords],
        status: contribData[i][CONTRIB_COLS.status]
      });
    }
  }

  return jsonResponse({
    submitterName: submitterName,
    photos: photos,
    contributions: contribRow
  });
}

// Admin handlers

function handleAdminListSubmissions(providedToken) {
  if (providedToken !== ADMIN_TOKEN) {
    return jsonResponse({ error: 'unauthorized', message: 'Invalid admin token' }, 403);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const submissions = ss.getSheetByName(SHEET_SUBMISSIONS);
  const data = submissions.getDataRange().getValues();
  const headerRow = data[0];

  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    results.push({
      submissionId: row[SUBMISSION_COLS.submissionId],
      event: row[SUBMISSION_COLS.event],
      submitterName: row[SUBMISSION_COLS.submitterName],
      email: row[SUBMISSION_COLS.email],
      phone: row[SUBMISSION_COLS.phone],
      photoIds: row[SUBMISSION_COLS.photoIds] || '',
      status: row[SUBMISSION_COLS.status] || '',
      token: row[SUBMISSION_COLS.token] || '',
      inviteSentAt: row[SUBMISSION_COLS.inviteSentAt] || ''
    });
  }

  return jsonResponse({ submissions: results });
}

function handleAdminGetSubmission(id, providedToken) {
  if (providedToken !== ADMIN_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 403);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const submissions = ss.getSheetByName(SHEET_SUBMISSIONS);
  const data = submissions.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][SUBMISSION_COLS.submissionId] === id) {
      const row = data[i];
      return jsonResponse({
        submissionId: row[SUBMISSION_COLS.submissionId],
        event: row[SUBMISSION_COLS.event],
        submitterName: row[SUBMISSION_COLS.submitterName],
        email: row[SUBMISSION_COLS.email],
        phone: row[SUBMISSION_COLS.phone],
        familyName: row[SUBMISSION_COLS.familyName],
        mmfNumber: row[SUBMISSION_COLS.mmfNumber],
        consentRef: row[SUBMISSION_COLS.consentRef],
        photoIds: row[SUBMISSION_COLS.photoIds] || '',
        status: row[SUBMISSION_COLS.status] || '',
        token: row[SUBMISSION_COLS.token] || '',
        inviteSentAt: row[SUBMISSION_COLS.inviteSentAt] || '',
        notes: row[SUBMISSION_COLS.notes] || ''
      });
    }
  }

  return jsonResponse({ error: 'not_found' }, 404);
}

function handleAdminCreateSubmission(data, providedToken) {
  if (providedToken !== ADMIN_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 403);
  }

  if (!data.submissionId) {
    return jsonResponse({ error: 'missing_submissionId' }, 400);
  }

  // Generate random token (>=16 chars)
  const token = Utilities.getUuid() + '-' + Utilities.getUuid().substring(0, 4);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const submissions = ss.getSheetByName(SHEET_SUBMISSIONS);

  const row = [
    data.submissionId || '',
    data.event || '',
    data.submitterName || '',
    data.email || '',
    data.phone || '',
    data.familyName || '',
    data.mmfNumber || '',
    data.consentRef || '',
    '', // photoIds
    'created', // status
    token,
    '', // inviteSentAt
    '' // notes
  ];

  submissions.appendRow(row);

  return jsonResponse({ status: 'created', submissionId: data.submissionId, token: token });
}

function handleAdminUpdateSubmission(data, providedToken) {
  if (providedToken !== ADMIN_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 403);
  }

  if (!data.id) {
    return jsonResponse({ error: 'missing_id' }, 400);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const submissions = ss.getSheetByName(SHEET_SUBMISSIONS);
  const allData = submissions.getDataRange().getValues();

  for (let i = 1; i < allData.length; i++) {
    if (allData[i][SUBMISSION_COLS.submissionId] === data.id) {
      const row = allData[i];
      if (data.photoIds !== undefined) row[SUBMISSION_COLS.photoIds] = data.photoIds;
      if (data.status !== undefined) row[SUBMISSION_COLS.status] = data.status;
      if (data.email !== undefined) row[SUBMISSION_COLS.email] = data.email;
      if (data.invitedAt !== undefined) row[SUBMISSION_COLS.inviteSentAt] = data.invitedAt;
      
      submissions.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return jsonResponse({ status: 'updated', id: data.id });
    }
  }

  return jsonResponse({ error: 'not_found' }, 404);
}

function handleAdminListContributions(providedToken) {
  if (providedToken !== ADMIN_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 403);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const contributions = ss.getSheetByName(SHEET_CONTRIBUTIONS);
  const data = contributions.getDataRange().getValues();

  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    results.push({
      id: row[CONTRIB_COLS.id],
      submissionId: row[CONTRIB_COLS.submissionId],
      photoId: row[CONTRIB_COLS.photoId],
      submittedAt: row[CONTRIB_COLS.submittedAt] || '',
      people: row[CONTRIB_COLS.people] || '',
      location: row[CONTRIB_COLS.location] || '',
      community: row[CONTRIB_COLS.community] || '',
      province: row[CONTRIB_COLS.province] || '',
      country: row[CONTRIB_COLS.country] || '',
      dateYear: row[CONTRIB_COLS.dateYear] || '',
      dateEra: row[CONTRIB_COLS.dateEra] || '',
      occasion: row[CONTRIB_COLS.occasion] || '',
      story: row[CONTRIB_COLS.story] || '',
      caption: row[CONTRIB_COLS.caption] || '',
      attribution: row[CONTRIB_COLS.attribution] || '',
      keywords: row[CONTRIB_COLS.keywords] || '',
      status: row[CONTRIB_COLS.status] || ''
    });
  }

  return jsonResponse({ contributions: results });
}

function handleAdminGetContribution(id, providedToken) {
  if (providedToken !== ADMIN_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 403);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const contributions = ss.getSheetByName(SHEET_CONTRIBUTIONS);
  const data = contributions.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][CONTRIB_COLS.id] === id) {
      const row = data[i];
      return jsonResponse({
        id: row[CONTRIB_COLS.id],
        submissionId: row[CONTRIB_COLS.submissionId],
        photoId: row[CONTRIB_COLS.photoId],
        submittedAt: row[CONTRIB_COLS.submittedAt],
        people: row[CONTRIB_COLS.people],
        location: row[CONTRIB_COLS.location],
        community: row[CONTRIB_COLS.community],
        province: row[CONTRIB_COLS.province],
        country: row[CONTRIB_COLS.country],
        dateYear: row[CONTRIB_COLS.dateYear],
        dateEra: row[CONTRIB_COLS.dateEra],
        occasion: row[CONTRIB_COLS.occasion],
        story: row[CONTRIB_COLS.story],
        caption: row[CONTRIB_COLS.caption],
        attribution: row[CONTRIB_COLS.attribution],
        keywords: row[CONTRIB_COLS.keywords],
        status: row[CONTRIB_COLS.status]
      });
    }
  }

  return jsonResponse({ error: 'not_found' }, 404);
}

function handleAdminUpdateContribution({ id, fields }, providedToken) {
  if (providedToken !== ADMIN_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 403);
  }

  if (!id) {
    return jsonResponse({ error: 'missing_id' }, 400);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const contributions = ss.getSheetByName(SHEET_CONTRIBUTIONS);
  const data = contributions.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][CONTRIB_COLS.id] === id) {
      const row = data[i];
      
      if (fields.people !== undefined) row[CONTRIB_COLS.people] = fields.people;
      if (fields.location !== undefined) row[CONTRIB_COLS.location] = fields.location;
      if (fields.community !== undefined) row[CONTRIB_COLS.community] = fields.community;
      if (fields.province !== undefined) row[CONTRIB_COLS.province] = fields.province;
      if (fields.country !== undefined) row[CONTRIB_COLS.country] = fields.country;
      if (fields.dateYear !== undefined) row[CONTRIB_COLS.dateYear] = fields.dateYear;
      if (fields.dateEra !== undefined) row[CONTRIB_COLS.dateEra] = fields.dateEra;
      if (fields.occasion !== undefined) row[CONTRIB_COLS.occasion] = fields.occasion;
      if (fields.story !== undefined) row[CONTRIB_COLS.story] = fields.story;
      if (fields.caption !== undefined) row[CONTRIB_COLS.caption] = fields.caption;
      if (fields.attribution !== undefined) row[CONTRIB_COLS.attribution] = fields.attribution;
      if (fields.keywords !== undefined) row[CONTRIB_COLS.keywords] = fields.keywords;
      if (fields.status !== undefined) row[CONTRIB_COLS.status] = fields.status;
      
      contributions.getRange(i + 1, 1, 1, row.length).setValues([row]);
      return jsonResponse({ status: 'updated', id: id });
    }
  }

  return jsonResponse({ error: 'not_found' }, 404);
}

function handleAdminDeleteContribution(id, providedToken) {
  if (providedToken !== ADMIN_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 403);
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const contributions = ss.getSheetByName(SHEET_CONTRIBUTIONS);
  const data = contributions.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][CONTRIB_COLS.id] === id) {
      contributions.deleteRow(i + 1);
      return jsonResponse({ status: 'deleted', id: id });
    }
  }

  return jsonResponse({ error: 'not_found' }, 404);
}

// Helper functions

function jsonResponse(obj) {
  const output = JSON.stringify(obj);
  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}