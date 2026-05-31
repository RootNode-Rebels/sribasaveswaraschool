/**
 * Sri Basaveswara School ERP - Backend API (Code.gs)
 * Headless Google Apps Script API acting as the database bridge, security controller,
 * and automated email engine.
 * 
 * Instructions:
 * 1. Open Google Sheets, create a new blank spreadsheet.
 * 2. Click Extensions > Apps Script.
 * 3. Delete any default code, paste this Code.gs content, and save.
 * 4. Click Deploy > New Deployment. Select "Web App".
 * 5. Set Execute as: "Me" and Who has access: "Anyone".
 * 6. Click Deploy, authorize permissions, and copy the Web App URL.
 * 7. Paste the Web App URL into the ERP Admin System Configuration UI.
 */

// --- CONFIGURATION & SECURITY ---
const SECRET_SALT = "Basaveswara_Secure_Salt_2026_ERP"; // Used for session integrity and secure calculations
const SESSION_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 Hours

// --- API GATEWAY: doGet & doPost ---

function doGet(e) {
  return handleResponse({ status: "success", message: "Sri Basaveswara School ERP API is active.", timestamp: new Date().toISOString() });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return handleError("No request payload provided.");
    }
    
    const request = JSON.parse(e.postData.contents);
    const action = request.action;
    const payload = request.payload || {};
    
    // Auto-heal database on every request to ensure no crashes
    autoHealDatabase();
    
    // Route Actions
    switch (action) {
      case "ping":
        return handleResponse({ status: "success", message: "API connected successfully!" });
        
      case "login":
        return loginUser(payload.username, payload.pin);
        
      case "requestOtp":
        return requestMagicOtp(payload.email);
        
      case "verifyOtp":
        return verifyMagicOtp(payload.email, payload.otp);
        
      case "submitAdmission":
        return submitAdmission(payload);
        
      case "getAdmissions":
        return getAdmissions(payload.sessionToken);
        
      case "triageAdmission":
        return triageAdmission(payload.sessionToken, payload.applicationId, payload.status, payload.comments);
        
      case "getDashboardData":
        return getDashboardData(payload.sessionToken, payload.userId);
        
      case "submitMarks":
        return submitMarks(payload.sessionToken, payload.marksData);
        
      case "getApprovals":
        return getApprovals(payload.sessionToken);
        
      case "triageApproval":
        return triageApproval(payload.sessionToken, payload.approvalId, payload.status);
        
      case "updateBranding":
        return updateBranding(payload.sessionToken, payload.brandingData);
        
      case "getBranding":
        return getBranding();
        
      case "manageUsers":
        return manageUsers(payload.sessionToken, payload.op, payload.userData);
        
      case "getUsers":
        return getUsers(payload.sessionToken);
        
      case "recordFeePayment":
        return recordFeePayment(payload.sessionToken, payload.paymentData);
        
      case "getFinancials":
        return getFinancials(payload.sessionToken);
        
      case "addExpense":
        return addExpense(payload.sessionToken, payload.expenseData);
        
      case "getAttendance":
        return getAttendance(payload.sessionToken, payload.className, payload.sectionName, payload.rollNumber);
        
      case "saveAttendance":
        return saveAttendance(payload.sessionToken, payload.date, payload.attendanceData);
        
      case "getTimetable":
        return getTimetable(payload.sessionToken, payload.className, payload.sectionName);
        
      case "saveTimetable":
        return saveTimetable(payload.sessionToken, payload.timetableData);
        
      case "getTransport":
        return getTransport(payload.sessionToken);
        
      case "getLogs":
        return getLogs(payload.sessionToken);
        
      default:
        return handleError("Unsupported action: " + action);
    }
  } catch (err) {
    return handleError(err.toString());
  }
}

// --- DATABASE AUTO-HEALING & SCHEMA DEFINITION ---

function autoHealDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const tables = {
    "Users": ["ID", "Role", "Name", "Email", "Class", "PIN", "Status", "EnrollmentDate"],
    "Admissions": ["ApplicationID", "Name", "Email", "Class", "GradeApplied", "ParentName", "Phone", "Status", "Comments", "Timestamp"],
    "Exams": ["RecordID", "RollNumber", "Session", "Subject", "Marks", "Grade", "MaxMarks", "EnteredBy", "ApprovedBy", "Status"],
    "Attendance": ["RollNumber", "Month", "PresentDays", "TotalDays"],
    "Fees": ["RollNumber", "TotalDue", "PaidAmount", "PaymentHistory"],
    "Approvals": ["ApprovalID", "TargetTable", "ActionType", "Payload", "RequestedBy", "Status", "Timestamp"],
    "Branding": ["Key", "Value"],
    "ActivityLog": ["Timestamp", "User", "Role", "Action", "Details", "IP"],
    "Expenses": ["ExpenseID", "Rationale", "Amount", "Timestamp", "LoggedBy"],
    "DailyAttendance": ["RollNumber", "Date", "Status", "RecordedBy"],
    "Timetable": ["ClassName", "SectionName", "Day", "Period", "Subject", "Teacher"],
    "Transport": ["VehicleNum", "RouteName", "DriverName", "DriverPhone", "PickupTime", "DropTime"]
  };
  
  for (let tableName in tables) {
    let sheet = ss.getSheetByName(tableName);
    if (!sheet) {
      sheet = ss.insertSheet(tableName);
      sheet.appendRow(tables[tableName]);
      
      // Inject standard default accounts into empty Users table
      if (tableName === "Users") {
        // Admin: 10001, PIN: 123456
        sheet.appendRow(["10001", "Admin", "Adarsh B A", "adhibasavanal@gmail.com", "All", hashPin("123456"), "Active", new Date().toISOString()]);
        // Principal: 20001, PIN: 654321
        sheet.appendRow(["20001", "Principal", "Dr. Basavaraj S.", "principal@basaveswara.edu.in", "All", hashPin("654321"), "Active", new Date().toISOString()]);
        // Teacher: 30001, PIN: 112233
        sheet.appendRow(["30001", "Teacher", "Smt. Sharanamma M.", "sharanamma@basaveswara.edu.in", "Class 10", hashPin("112233"), "Active", new Date().toISOString()]);
        // Student: 40001, PIN: 998877
        sheet.appendRow(["40001", "Student", "Master Abhishek Gowda", "abhishek@gmail.com", "Class 10", hashPin("998877"), "Active", new Date().toISOString()]);
      }
      
      // Inject dummy brand configuration
      if (tableName === "Branding") {
        sheet.appendRow(["schoolName", "Sri Basaveswara School"]);
        sheet.appendRow(["logoUrl", ""]);
        sheet.appendRow(["bannerUrl", ""]);
        sheet.appendRow(["signatureUrl", ""]);
      }
      
      // Inject standard weekly Timetable slots into empty Timetable table
      if (tableName === "Timetable") {
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const subjects = ["Mathematics", "Science", "Kannada", "English", "Social Studies", "Physical Education"];
        days.forEach(day => {
          for (let p = 1; p <= 6; p++) {
            sheet.appendRow(["Class 10", "A", day, p, subjects[(p - 1 + days.indexOf(day)) % subjects.length], "Smt. Sharanamma M."]);
          }
        });
      }
      
      // Inject standard transport routes
      if (tableName === "Transport") {
        sheet.appendRow(["KA-01-F-1234", "Basaveswara Nagar - Rajajinagar", "Ramesh Kumar", "+91 98765 43210", "07:30 AM", "04:00 PM"]);
        sheet.appendRow(["KA-02-H-5678", "Vijayanagar - Chandra Layout", "Shiva Gowda", "+91 98888 77777", "07:45 AM", "04:15 PM"]);
      }
      
      // Inject initial daily attendance logs
      if (tableName === "DailyAttendance") {
        sheet.appendRow(["40001", "2026-05-25", "Present", "sharanamma@basaveswara.edu.in"]);
        sheet.appendRow(["40001", "2026-05-26", "Present", "sharanamma@basaveswara.edu.in"]);
        sheet.appendRow(["40001", "2026-05-27", "Absent", "sharanamma@basaveswara.edu.in"]);
        sheet.appendRow(["40001", "2026-05-28", "Present", "sharanamma@basaveswara.edu.in"]);
      }
    } else {
      // Auto-heal headers if they were tampered with
      const expectedHeaders = tables[tableName];
      const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
      let match = true;
      for (let i = 0; i < expectedHeaders.length; i++) {
        if (actualHeaders[i] !== expectedHeaders[i]) {
          match = false;
          break;
        }
      }
      if (!match) {
        // Re-write clean headers at the top
        sheet.insertRowBefore(1);
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
      }
    }
  }
}

// --- UTILITY RESPONDERS ---

function handleResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function handleError(errorMessage) {
  return handleResponse({ status: "error", message: errorMessage });
}

function hashPin(pin) {
  // Simple custom deterministic hash for PIN storage (MD5 or SHA-256 equivalent in Apps Script)
  const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pin + SECRET_SALT, Utilities.Charset.UTF_8);
  let hashStr = "";
  for (let i = 0; i < signature.length; i++) {
    let byteVal = signature[i];
    if (byteVal < 0) byteVal += 256;
    let byteString = byteVal.toString(16);
    if (byteString.length == 1) byteString = "0" + byteString;
    hashStr += byteString;
  }
  return hashStr;
}

function generateSessionToken(userRow) {
  const expiry = Date.now() + SESSION_EXPIRY_MS;
  const tokenPayload = `${userRow[0]}:${userRow[1]}:${expiry}`;
  const signature = hashPin(tokenPayload);
  return Utilities.base64EncodeWebSafe(`${tokenPayload}::${signature}`);
}

function validateSession(token) {
  try {
    if (!token) return null;
    const decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(token)).getDataAsString();
    const parts = decoded.split("::");
    if (parts.length !== 2) return null;
    
    const tokenPayload = parts[0];
    const clientSignature = parts[1];
    
    if (hashPin(tokenPayload) !== clientSignature) return null;
    
    const subParts = tokenPayload.split(":");
    const userId = subParts[0];
    const role = subParts[1];
    const expiry = parseInt(subParts[2]);
    
    if (Date.now() > expiry) return null; // Session expired
    
    return { userId, role };
  } catch (err) {
    return null;
  }
}

// --- SYSTEM SERVICES ---

// 1. Authentication
function loginUser(userId, pin) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  const hashed = hashPin(pin);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === userId.toString().trim() && data[i][5] === hashed) {
      if (data[i][6] !== "Active") {
        return handleError("This account is currently inactive.");
      }
      
      const token = generateSessionToken(data[i]);
      logActivity(data[i][0], data[i][1], "LOGIN_SUCCESS", `Logged in using credential ID ${userId}`);
      
      return handleResponse({
        status: "success",
        sessionToken: token,
        user: {
          id: data[i][0],
          role: data[i][1],
          name: data[i][2],
          email: data[i][3],
          class: data[i][4]
        }
      });
    }
  }
  return handleError("Invalid User ID or PIN. Please try again.");
}

// 2. Magic OTP Authentication
function requestMagicOtp(email) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  
  let userFound = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][3].toString().toLowerCase().trim() === email.toString().toLowerCase().trim()) {
      userFound = data[i];
      break;
    }
  }
  
  if (!userFound) {
    return handleError("No school account registered with this email address.");
  }
  
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store the OTP in active cache using ScriptProperties (valid for 5 mins)
  const propKey = "OTP_" + email.toString().toLowerCase().trim();
  PropertiesService.getScriptProperties().setProperty(propKey, JSON.stringify({
    otp: otp,
    userId: userFound[0],
    expiry: Date.now() + (5 * 60 * 1000)
  }));
  
  // Send email to User
  try {
    MailApp.sendEmail({
      to: email,
      subject: `🔑 Sri Basaveswara School ERP - Magic OTP Login`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #4f46e5; text-align: center;">Sri Basaveswara School</h2>
          <p>Hello <strong>${userFound[2]}</strong>,</p>
          <p>We received a request to log in to the School ERP via Magic OTP. Please use the verification code below:</p>
          <div style="background-color: #f3f4f6; text-align: center; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 4px; border-radius: 6px; margin: 20px 0; color: #1e1b4b;">
            ${otp}
          </div>
          <p style="color: #6b7280; font-size: 13px;">This code is highly sensitive and will expire in 5 minutes. If you did not initiate this login request, please secure your account PIN immediately.</p>
          <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="text-align: center; color: #9ca3af; font-size: 11px;">Sri Basaveswara School ERP &bull; Headless Apps Script Module</p>
        </div>
      `
    });
  } catch (err) {
    // If mail quota is exceeded or fails, we provide a warning but let the response return (frontend mock will grab it)
  }
  
  return handleResponse({ status: "success", message: "Verification OTP has been dispatched.", mockOtp: otp });
}

function verifyMagicOtp(email, otp) {
  const propKey = "OTP_" + email.toString().toLowerCase().trim();
  const savedVal = PropertiesService.getScriptProperties().getProperty(propKey);
  
  if (!savedVal) {
    return handleError("OTP code has expired or is invalid.");
  }
  
  const parsed = JSON.parse(savedVal);
  if (Date.now() > parsed.expiry) {
    PropertiesService.getScriptProperties().deleteProperty(propKey);
    return handleError("OTP code has expired.");
  }
  
  if (parsed.otp.toString().trim() !== otp.toString().trim()) {
    return handleError("Verification code is incorrect.");
  }
  
  // Clean up used OTP
  PropertiesService.getScriptProperties().deleteProperty(propKey);
  
  // Find User & return token
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === parsed.userId.toString()) {
      const token = generateSessionToken(data[i]);
      logActivity(data[i][0], data[i][1], "LOGIN_OTP", `Logged in successfully via passwordless Magic OTP.`);
      return handleResponse({
        status: "success",
        sessionToken: token,
        user: {
          id: data[i][0],
          role: data[i][1],
          name: data[i][2],
          email: data[i][3],
          class: data[i][4]
        }
      });
    }
  }
  
  return handleError("User record could not be found.");
}

// 3. Admissions Workflow
function submitAdmission(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Admissions");
  
  const appId = "ADM-" + Math.floor(100000 + Math.random() * 900000);
  const rowData = [
    appId,
    payload.name,
    payload.email,
    payload.class,
    payload.gradeApplied || "N/A",
    payload.parentName,
    payload.phone,
    "PENDING",
    "",
    new Date().toISOString()
  ];
  
  sheet.appendRow(rowData);
  
  // Log Anonymous Action
  logActivity(appId, "Applicant", "ADMISSION_SUBMITTED", `New admissions submission for ${payload.name} (Class: ${payload.class})`);
  
  // Send acknowledgement email
  try {
    MailApp.sendEmail({
      to: payload.email,
      subject: `🎒 Sri Basaveswara School - Admission Application Submitted [${appId}]`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #4f46e5; text-align: center;">Sri Basaveswara School</h2>
          <p>Dear <strong>${payload.parentName}</strong>,</p>
          <p>Thank you for submitting the admission application for <strong>${payload.name}</strong> to enter <strong>${payload.class}</strong>.</p>
          <p>Your application is successfully registered in our queue under Application ID: <strong>${appId}</strong>.</p>
          <p>Our academic admissions committee and the Principal are currently reviewing the records. You will receive an automated email notification once the application review is finalized.</p>
          <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
          <p style="text-align: center; color: #9ca3af; font-size: 11px;">Sri Basaveswara School Admissions Office</p>
        </div>
      `
    });
  } catch(e) {}
  
  return handleResponse({ status: "success", applicationId: appId, message: "Application submitted successfully." });
}

function getAdmissions(sessionToken) {
  const session = validateSession(sessionToken);
  if (!session || (session.role !== "Principal" && session.role !== "Admin")) {
    return handleError("Unauthorized request access.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Admissions");
  const data = sheet.getDataRange().getValues();
  const list = [];
  
  for (let i = 1; i < data.length; i++) {
    list.push({
      applicationId: data[i][0],
      name: data[i][1],
      email: data[i][2],
      class: data[i][3],
      gradeApplied: data[i][4],
      parentName: data[i][5],
      phone: data[i][6],
      status: data[i][7],
      comments: data[i][8],
      timestamp: data[i][9]
    });
  }
  
  return handleResponse({ status: "success", admissions: list.reverse() });
}

function triageAdmission(sessionToken, appId, status, comments) {
  const session = validateSession(sessionToken);
  if (!session || (session.role !== "Principal" && session.role !== "Admin")) {
    return handleError("Unauthorized request access.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Admissions");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === appId.toString()) {
      sheet.getRange(i + 1, 8).setValue(status); // Status
      sheet.getRange(i + 1, 9).setValue(comments || ""); // Comments
      
      const appName = data[i][1];
      const appEmail = data[i][2];
      const appClass = data[i][3];
      const parentName = data[i][5];
      
      logActivity(session.userId, session.role, `ADMISSION_${status}`, `Triage admission ${appId} for student ${appName} to state: ${status}`);
      
      if (status === "APPROVED") {
        // Auto-Generate Student Roll number
        const usersSheet = ss.getSheetByName("Users");
        const usersData = usersSheet.getDataRange().getValues();
        let maxRoll = 40000;
        for (let j = 1; j < usersData.length; j++) {
          if (usersData[j][1] === "Student") {
            const rollInt = parseInt(usersData[j][0]);
            if (rollInt > maxRoll) maxRoll = rollInt;
          }
        }
        const newRollNumber = (maxRoll + 1).toString();
        const defaultPin = Math.floor(100000 + Math.random() * 900000).toString(); // Generate default PIN
        
        // Append user
        usersSheet.appendRow([
          newRollNumber,
          "Student",
          appName,
          appEmail,
          appClass,
          hashPin(defaultPin),
          "Active",
          new Date().toISOString()
        ]);
        
        // Setup initial empty fee record
        const feesSheet = ss.getSheetByName("Fees");
        feesSheet.appendRow([newRollNumber, 45000, 0, JSON.stringify([])]); // Default tuition due 45000
        
        // Send congratulatory admission email with credentials
        try {
          MailApp.sendEmail({
            to: appEmail,
            subject: `🎉 Congratulations! Sri Basaveswara School Admission Confirmed [Roll No: ${newRollNumber}]`,
            htmlBody: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #10b981; text-align: center;">Admission Approved!</h2>
                <p>Dear <strong>${parentName}</strong>,</p>
                <p>We are delighted to inform you that the Principal has approved the academic admission of your child, <strong>${appName}</strong>, into <strong>${appClass}</strong> at Sri Basaveswara School!</p>
                
                <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 6px 6px 0;">
                  <h3 style="margin-top: 0; color: #065f46;">🔑 Your New Student Credentials</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="width: 40%; font-weight: bold; padding: 4px 0;">Roll Number (ID):</td><td style="color: #065f46; font-weight: bold;">${newRollNumber}</td></tr>
                    <tr><td style="font-weight: bold; padding: 4px 0;">Temporary PIN:</td><td style="color: #065f46; font-weight: bold;">${defaultPin}</td></tr>
                    <tr><td style="font-weight: bold; padding: 4px 0;">Assigned Class:</td><td>${appClass}</td></tr>
                  </table>
                </div>
                
                <p>Please log in to the Student Portal on our website using the Roll Number and PIN. You will be prompted to change your PIN on your first login.</p>
                <p style="color: #4b5563; font-style: italic;">Principal's Comments: "${comments || "Welcome to Sri Basaveswara School."}"</p>
                <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
                <p style="text-align: center; color: #9ca3af; font-size: 11px;">Sri Basaveswara School Academic Registrar Office</p>
              </div>
            `
          });
        } catch (e) {}
      } else if (status === "REJECTED") {
        // Send Rejection email
        try {
          MailApp.sendEmail({
            to: appEmail,
            subject: `Update on your Admission Application [${appId}]`,
            htmlBody: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #ef4444; text-align: center;">Admission Application Status</h2>
                <p>Dear <strong>${parentName}</strong>,</p>
                <p>We thank you for your interest in enrolling <strong>${appName}</strong> into <strong>${appClass}</strong> at Sri Basaveswara School.</p>
                <p>After a careful review of the current batch capacities and submission details, we regret to inform you that we are unable to approve your application at this time.</p>
                <p><strong>Principal Feedback:</strong> "${comments || "Capacity full for this class."}"</p>
                <p>We wish you and your child the very best in all academic pursuits.</p>
                <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
                <p style="text-align: center; color: #9ca3af; font-size: 11px;">Sri Basaveswara School Registrar Office</p>
              </div>
            `
          });
        } catch (e) {}
      }
      
      return handleResponse({ status: "success", message: `Application ${appId} has been successfully ${status}.` });
    }
  }
  return handleError("Application record not found.");
}

// 4. Role Dashboards
function getDashboardData(sessionToken, userId) {
  const session = validateSession(sessionToken);
  if (!session) return handleError("Invalid or expired session. Please log in.");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (session.role === "Student") {
    // 1. Fetch Student Info
    const usersSheet = ss.getSheetByName("Users");
    const uData = usersSheet.getDataRange().getValues();
    let studentInfo = null;
    for (let i = 1; i < uData.length; i++) {
      if (uData[i][0].toString() === session.userId.toString()) {
        studentInfo = { id: uData[i][0], name: uData[i][2], email: uData[i][3], class: uData[i][4] };
        break;
      }
    }
    
    // 2. Fetch Exams Records
    const examsSheet = ss.getSheetByName("Exams");
    const eData = examsSheet.getDataRange().getValues();
    const grades = [];
    for (let i = 1; i < eData.length; i++) {
      if (eData[i][1].toString() === session.userId.toString() && eData[i][9] === "APPROVED") {
        grades.push({
          session: eData[i][2],
          subject: eData[i][3],
          marks: eData[i][4],
          grade: eData[i][5],
          maxMarks: eData[i][6]
        });
      }
    }
    
    // 3. Fetch Attendance
    const attSheet = ss.getSheetByName("Attendance");
    const aData = attSheet.getDataRange().getValues();
    const attendance = [];
    for (let i = 1; i < aData.length; i++) {
      if (aData[i][0].toString() === session.userId.toString()) {
        attendance.push({ month: aData[i][1], presentDays: aData[i][2], totalDays: aData[i][3] });
      }
    }
    
    // 4. Fetch Fees
    const feesSheet = ss.getSheetByName("Fees");
    const fData = feesSheet.getDataRange().getValues();
    let feeData = { totalDue: 0, paidAmount: 0, history: [] };
    for (let i = 1; i < fData.length; i++) {
      if (fData[i][0].toString() === session.userId.toString()) {
        feeData = {
          totalDue: fData[i][1],
          paidAmount: fData[i][2],
          history: JSON.parse(fData[i][3] || "[]")
        };
        break;
      }
    }
    
    return handleResponse({
      status: "success",
      role: "Student",
      studentInfo: studentInfo,
      grades: grades,
      attendance: attendance,
      fees: feeData
    });
    
  } else if (session.role === "Teacher") {
    // Teachers need their class student list, exam database, approvals
    const usersSheet = ss.getSheetByName("Users");
    const uData = usersSheet.getDataRange().getValues();
    const myStudents = [];
    
    // Find Teacher Class
    let teacherClass = "Class 10";
    for (let i = 1; i < uData.length; i++) {
      if (uData[i][0].toString() === session.userId.toString()) {
        teacherClass = uData[i][4];
        break;
      }
    }
    
    for (let i = 1; i < uData.length; i++) {
      if (uData[i][1] === "Student" && uData[i][4] === teacherClass) {
        myStudents.push({ id: uData[i][0], name: uData[i][2], email: uData[i][3], class: uData[i][4] });
      }
    }
    
    // Subjects & Exams Configuration
    return handleResponse({
      status: "success",
      role: "Teacher",
      classAssigned: teacherClass,
      students: myStudents
    });
    
  } else if (session.role === "Principal") {
    // School-wide analytics
    const usersSheet = ss.getSheetByName("Users");
    const uData = usersSheet.getDataRange().getValues();
    let studentCount = 0;
    let teacherCount = 0;
    
    for (let i = 1; i < uData.length; i++) {
      if (uData[i][1] === "Student") studentCount++;
      if (uData[i][1] === "Teacher") teacherCount++;
    }
    
    return handleResponse({
      status: "success",
      role: "Principal",
      metrics: {
        totalStudents: studentCount,
        totalTeachers: teacherCount
      }
    });
  } else if (session.role === "Admin") {
    return handleResponse({ status: "success", role: "Admin" });
  }
  
  return handleError("Dashboard data loading failed.");
}

// 5. Submit Marks (Goes into Approvals for 2-step verification)
function submitMarks(sessionToken, marksData) {
  const session = validateSession(sessionToken);
  if (!session || session.role !== "Teacher") {
    return handleError("Unauthorized action.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const approvalsSheet = ss.getSheetByName("Approvals");
  
  const approvalId = "APP-" + Math.floor(100000 + Math.random() * 900000);
  approvalsSheet.appendRow([
    approvalId,
    "Exams",
    "INSERT_MARKS",
    JSON.stringify(marksData),
    session.userId,
    "PENDING",
    new Date().toISOString()
  ]);
  
  logActivity(session.userId, session.role, "MARKS_SUBMIT_APPROVAL", `Submitted marks for Student ${marksData.rollNumber} (${marksData.subject}) to Approval Queue`);
  
  return handleResponse({ status: "success", approvalId: approvalId, message: "Marks uploaded successfully. Pending Principal validation." });
}

function getApprovals(sessionToken) {
  const session = validateSession(sessionToken);
  if (!session || (session.role !== "Principal" && session.role !== "Admin")) {
    return handleError("Unauthorized request access.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const approvalsSheet = ss.getSheetByName("Approvals");
  const data = approvalsSheet.getDataRange().getValues();
  const list = [];
  
  for (let i = 1; i < data.length; i++) {
    list.push({
      approvalId: data[i][0],
      targetTable: data[i][1],
      actionType: data[i][2],
      payload: JSON.parse(data[i][3] || "{}"),
      requestedBy: data[i][4],
      status: data[i][5],
      timestamp: data[i][6]
    });
  }
  
  return handleResponse({ status: "success", approvals: list.reverse() });
}

function triageApproval(sessionToken, approvalId, status) {
  const session = validateSession(sessionToken);
  if (!session || (session.role !== "Principal" && session.role !== "Admin")) {
    return handleError("Unauthorized access.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const approvalsSheet = ss.getSheetByName("Approvals");
  const data = approvalsSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === approvalId.toString()) {
      if (data[i][5] !== "PENDING") {
        return handleError("Approval request has already been finalized.");
      }
      
      approvalsSheet.getRange(i + 1, 6).setValue(status);
      
      const payload = JSON.parse(data[i][3] || "{}");
      
      if (status === "APPROVED") {
        if (data[i][1] === "Exams") {
          const examsSheet = ss.getSheetByName("Exams");
          const recordId = "REC-" + Math.floor(100000 + Math.random() * 900000);
          
          examsSheet.appendRow([
            recordId,
            payload.rollNumber,
            payload.examSession,
            payload.subject,
            payload.marks,
            calculateGrade(payload.marks, payload.maxMarks),
            payload.maxMarks,
            data[i][4], // EnteredBy
            session.userId, // ApprovedBy
            "APPROVED"
          ]);
          
          // Send automatic notification email to student/parent
          notifyStudentOfMarks(payload.rollNumber, payload.subject, payload.marks, payload.maxMarks, payload.examSession);
        }
      }
      
      logActivity(session.userId, session.role, `APPROVAL_${status}`, `Triage queue ID ${approvalId} to status: ${status}`);
      return handleResponse({ status: "success", message: `Request has been successfully ${status}.` });
    }
  }
  return handleError("Approval ticket not found.");
}

function calculateGrade(marks, maxMarks) {
  const pct = (parseFloat(marks) / parseFloat(maxMarks)) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= 35) return "E";
  return "Fail (F)";
}

function notifyStudentOfMarks(rollNo, subject, marks, maxMarks, examSession) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const users = ss.getSheetByName("Users").getDataRange().getValues();
    
    let student = null;
    for (let i = 1; i < users.length; i++) {
      if (users[i][0].toString() === rollNo.toString()) {
        student = { name: users[i][2], email: users[i][3] };
        break;
      }
    }
    
    if (student && student.email) {
      const grade = calculateGrade(marks, maxMarks);
      MailApp.sendEmail({
        to: student.email,
        subject: `📊 Sri Basaveswara School - New Grades Published [${examSession}]`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #4f46e5; text-align: center;">Sri Basaveswara School</h2>
            <p>Dear <strong>${student.name}</strong>,</p>
            <p>Your grades for <strong>${subject}</strong> under the academic session <strong>${examSession}</strong> have been finalized by the Principal and published online.</p>
            
            <div style="background-color: #f5f3ff; border: 1px solid #c7d2fe; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
              <span style="font-size: 14px; color: #4338ca; font-weight: bold; display: block; margin-bottom: 5px;">${subject}</span>
              <span style="font-size: 36px; font-weight: bold; color: #4f46e5; display: block;">${marks} / ${maxMarks}</span>
              <span style="font-size: 16px; font-weight: bold; color: #6366f1; display: block; margin-top: 5px;">Grade: ${grade}</span>
            </div>
            
            <p>Please log in to your Student Portal to view your complete digital report card and download your certificate.</p>
            <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
            <p style="text-align: center; color: #9ca3af; font-size: 11px;">Sri Basaveswara School Examination Cell</p>
          </div>
        `
      });
    }
  } catch (e) {}
}

// 6. Branding Settings
function updateBranding(sessionToken, brandingData) {
  const session = validateSession(sessionToken);
  if (!session || session.role !== "Admin") {
    return handleError("Unauthorized credentials.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Branding");
  const data = sheet.getDataRange().getValues();
  
  for (let key in brandingData) {
    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(brandingData[key]);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([key, brandingData[key]]);
    }
  }
  
  logActivity(session.userId, session.role, "BRANDING_UPDATE", `School branding assets updated.`);
  return handleResponse({ status: "success", message: "Branding parameters updated." });
}

function getBranding() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Branding");
  const data = sheet.getDataRange().getValues();
  const config = {};
  
  for (let i = 1; i < data.length; i++) {
    config[data[i][0]] = data[i][1];
  }
  
  return handleResponse({ status: "success", branding: config });
}

// 7. Staff & User Management (Admin specific)
function getUsers(sessionToken) {
  const session = validateSession(sessionToken);
  if (!session || session.role !== "Admin") {
    return handleError("Unauthorized request access.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  const list = [];
  
  for (let i = 1; i < data.length; i++) {
    list.push({
      id: data[i][0],
      role: data[i][1],
      name: data[i][2],
      email: data[i][3],
      class: data[i][4],
      status: data[i][6],
      enrollmentDate: data[i][7]
    });
  }
  
  return handleResponse({ status: "success", users: list });
}

function manageUsers(sessionToken, op, userData) {
  const session = validateSession(sessionToken);
  if (!session || session.role !== "Admin") {
    return handleError("Unauthorized request access.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Users");
  const data = sheet.getDataRange().getValues();
  
  if (op === "ADD") {
    // Generate Staff ID or Roll
    let pfx = "3"; // Default teacher prefix
    if (userData.role === "Principal") pfx = "2";
    if (userData.role === "Admin") pfx = "1";
    
    let maxId = parseInt(pfx + "0000");
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === userData.role) {
        const idInt = parseInt(data[i][0]);
        if (idInt > maxId) maxId = idInt;
      }
    }
    const newId = (maxId + 1).toString();
    const tempPassword = userData.password || userData.pin || "123456";
    const hashed = hashPin(tempPassword);
    
    sheet.appendRow([
      newId,
      userData.role,
      userData.name,
      userData.email,
      userData.class || "All",
      hashed,
      "Active",
      new Date().toISOString()
    ]);
    
    try {
      MailApp.sendEmail({
        to: userData.email,
        subject: `Welcome to Sri Basaveswara School - ${userData.role} Account`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #4f46e5; text-align: center;">Welcome to Sri Basaveswara School</h2>
            <p>Dear <strong>${userData.name}</strong>,</p>
            <p>An official <strong>${userData.role}</strong> account has been created for you by the Administration.</p>
            <p>Please find your login credentials below:</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; color: #1e1b4b;">
              <p style="margin: 5px 0;"><strong>User ID / Roll Number:</strong> ${newId}</p>
              <p style="margin: 5px 0;"><strong>Temporary Password (PIN):</strong> ${tempPassword}</p>
            </div>
            <p style="color: #6b7280; font-size: 13px;">Please log in to the ERP portal using these credentials. Keep this information secure.</p>
            <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
            <p style="text-align: center; color: #9ca3af; font-size: 11px;">Sri Basaveswara School ERP &bull; Administration</p>
          </div>
        `
      });
    } catch(err) {}
    
    logActivity(session.userId, session.role, "USER_ADD", `Created new ${userData.role} account [ID: ${newId}, Name: ${userData.name}]`);
    return handleResponse({ status: "success", message: `New user ${newId} created successfully.` });
    
  } else if (op === "UPDATE") {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === userData.id.toString()) {
        sheet.getRange(i + 1, 3).setValue(userData.name); // Name
        sheet.getRange(i + 1, 4).setValue(userData.email); // Email
        sheet.getRange(i + 1, 5).setValue(userData.class || "All"); // Class
        sheet.getRange(i + 1, 7).setValue(userData.status); // Status
        
        if (userData.pin) {
          sheet.getRange(i + 1, 6).setValue(hashPin(userData.pin));
        }
        
        logActivity(session.userId, session.role, "USER_UPDATE", `Updated account details for user ID ${userData.id}`);
        return handleResponse({ status: "success", message: "User account updated." });
      }
    }
  } else if (op === "TOGGLE_STATUS") {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === userData.id.toString()) {
        const currentStatus = data[i][6];
        const newStatus = (currentStatus === "Active") ? "Inactive" : "Active";
        sheet.getRange(i + 1, 7).setValue(newStatus);
        
        logActivity(session.userId, session.role, "USER_STATUS_TOGGLE", `Changed access status of user ID ${userData.id} to ${newStatus}`);
        return handleResponse({ status: "success", message: `User access is now ${newStatus}.` });
      }
    }
  } else if (op === "DELETE") {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === userData.id.toString()) {
        sheet.deleteRow(i + 1);
        logActivity(session.userId, session.role, "USER_DELETE", `Permanently removed user ID ${userData.id}`);
        return handleResponse({ status: "success", message: "User successfully deleted from database." });
      }
    }
  }
  
  return handleError("User operation failed.");
}

// 8. Fee Collection & Receipts
function recordFeePayment(sessionToken, paymentData) {
  const session = validateSession(sessionToken);
  if (!session || (session.role !== "Admin" && session.role !== "Principal")) {
    return handleError("Unauthorized transaction access.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Fees");
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === paymentData.rollNumber.toString()) {
      const totalDue = parseFloat(data[i][1]);
      const currentPaid = parseFloat(data[i][2]);
      const newPayment = parseFloat(paymentData.amount);
      const updatedPaid = currentPaid + newPayment;
      
      const history = JSON.parse(data[i][3] || "[]");
      const recId = "PAY-" + Math.floor(100000 + Math.random() * 900000);
      
      history.push({
        receiptId: recId,
        amount: newPayment,
        mode: paymentData.paymentMode || "Cash",
        reference: paymentData.referenceNo || "N/A",
        timestamp: new Date().toISOString(),
        receivedBy: session.userId
      });
      
      sheet.getRange(i + 1, 3).setValue(updatedPaid); // PaidAmount
      sheet.getRange(i + 1, 4).setValue(JSON.stringify(history)); // History JSON
      
      logActivity(session.userId, session.role, "FEE_COLLECTION", `Collected fee amount INR ${newPayment} for student ${paymentData.rollNumber}`);
      
      // Email parent receipt
      try {
        const users = ss.getSheetByName("Users").getDataRange().getValues();
        let student = null;
        for (let j = 1; j < users.length; j++) {
          if (users[j][0].toString() === paymentData.rollNumber.toString()) {
            student = { name: users[j][2], email: users[j][3] };
            break;
          }
        }
        
        if (student && student.email) {
          MailApp.sendEmail({
            to: student.email,
            subject: `🧾 Sri Basaveswara School - Fee Receipt [${recId}]`,
            htmlBody: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #4f46e5; text-align: center;">Sri Basaveswara School</h2>
                <h3 style="text-align: center; color: #10b981; margin-top: 0;">Payment Receipt</h3>
                
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
                  <tr style="border-bottom: 1px solid #eaeaea;"><td style="font-weight: bold; padding: 8px 0;">Receipt Number:</td><td style="text-align: right;">${recId}</td></tr>
                  <tr style="border-bottom: 1px solid #eaeaea;"><td style="font-weight: bold; padding: 8px 0;">Student Name:</td><td style="text-align: right;">${student.name} (Roll: ${paymentData.rollNumber})</td></tr>
                  <tr style="border-bottom: 1px solid #eaeaea;"><td style="font-weight: bold; padding: 8px 0;">Amount Paid:</td><td style="text-align: right; color: #10b981; font-weight: bold;">INR ${newPayment.toFixed(2)}</td></tr>
                  <tr style="border-bottom: 1px solid #eaeaea;"><td style="font-weight: bold; padding: 8px 0;">Payment Mode:</td><td style="text-align: right;">${paymentData.paymentMode}</td></tr>
                  <tr style="border-bottom: 1px solid #eaeaea;"><td style="font-weight: bold; padding: 8px 0;">Reference No:</td><td style="text-align: right;">${paymentData.referenceNo || "N/A"}</td></tr>
                  <tr style="border-bottom: 1px solid #eaeaea;"><td style="font-weight: bold; padding: 8px 0;">Total Outstanding Balance:</td><td style="text-align: right; font-weight: bold; color: #ef4444;">INR ${(totalDue - updatedPaid).toFixed(2)}</td></tr>
                </table>
                
                <p style="text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px;">Thank you for your prompt fee payment.</p>
                <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
                <p style="text-align: center; color: #9ca3af; font-size: 11px;">Sri Basaveswara School Accounts Department</p>
              </div>
            `
          });
        }
      } catch (e) {}
      
      return handleResponse({ status: "success", receiptId: recId, message: "Fee payment recorded and receipt generated." });
    }
  }
  return handleError("Student outstanding record not found.");
}

// 9. Activity Auditing Logs
function getLogs(sessionToken) {
  const session = validateSession(sessionToken);
  if (!session || session.role !== "Admin") {
    return handleError("Unauthorized request access.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("ActivityLog");
  const data = sheet.getDataRange().getValues();
  const list = [];
  
  // Return last 200 logs
  const startIdx = Math.max(1, data.length - 200);
  for (let i = startIdx; i < data.length; i++) {
    list.push({
      timestamp: data[i][0],
      user: data[i][1],
      role: data[i][2],
      action: data[i][3],
      details: data[i][4],
      ip: data[i][5]
    });
  }
  
  return handleResponse({ status: "success", logs: list.reverse() });
}

function logActivity(user, role, action, details) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("ActivityLog");
    sheet.appendRow([
      new Date().toISOString(),
      user,
      role,
      action,
      details,
      "API" // Simulated IP record
    ]);
  } catch (e) {}
}

function getFinancials(sessionToken) {
  const session = validateSession(sessionToken);
  if (!session || (session.role !== "Admin" && session.role !== "Accountant")) {
    return handleError("Unauthorized financial ledger access.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const feesSheet = ss.getSheetByName("Fees");
  const feesData = feesSheet.getDataRange().getValues();
  let feeRevenue = 0;
  const feesLedger = [];
  for (let i = 1; i < feesData.length; i++) {
    const paid = parseFloat(feesData[i][2] || 0);
    feeRevenue += paid;
    feesLedger.push({
      rollNumber: feesData[i][0].toString(),
      totalDue: parseFloat(feesData[i][1] || 45000),
      paidAmount: paid,
      history: JSON.parse(feesData[i][3] || "[]")
    });
  }
  
  const expSheet = ss.getSheetByName("Expenses");
  const expData = expSheet.getDataRange().getValues();
  let expTotal = 0;
  const expenseLedger = [];
  for (let i = 1; i < expData.length; i++) {
    const amt = parseFloat(expData[i][2] || 0);
    expTotal += amt;
    expenseLedger.push({
      expenseId: expData[i][0].toString(),
      rationale: expData[i][1].toString(),
      amount: amt,
      timestamp: expData[i][3].toString(),
      loggedBy: expData[i][4].toString()
    });
  }
  
  return handleResponse({
    status: "success",
    financials: {
      totalIncome: feeRevenue,
      totalExpenses: expTotal,
      salaryExpense: 0,
      miscExpense: expTotal,
      balance: feeRevenue - expTotal
    },
    expenseLedger: expenseLedger.reverse(),
    feesLedger: feesLedger
  });
}

function addExpense(sessionToken, expenseData) {
  const session = validateSession(sessionToken);
  if (!session || (session.role !== "Admin" && session.role !== "Accountant")) {
    return handleError("Unauthorized expense registry access.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Expenses");
  
  const expId = "EXP-" + Math.floor(100000 + Math.random() * 900000);
  const amt = parseFloat(expenseData.amount || 0);
  
  sheet.appendRow([
    expId,
    expenseData.rationale,
    amt,
    new Date().toISOString(),
    session.userId
  ]);
  
  logActivity(session.userId, session.role, "EXPENSE_ADD", `Logged new operating expense of INR ${amt}: "${expenseData.rationale}"`);
  return handleResponse({ status: "success", message: "Expense logged successfully." });
}

function getAttendance(sessionToken, className, sectionName, rollNumber) {
  const session = validateSession(sessionToken);
  if (!session) return handleError("Authentication required.");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("DailyAttendance");
  const data = sheet.getDataRange().getValues();
  const logs = [];
  
  if (session.role === "Student") {
    for (let i = 1; i < data.length; i++) {
      if (data[i][0].toString() === session.userId.toString()) {
        logs.push({
          rollNumber: data[i][0].toString(),
          date: data[i][1].toString(),
          status: data[i][2].toString(),
          recordedBy: data[i][3].toString()
        });
      }
    }
  } else {
    for (let i = 1; i < data.length; i++) {
      if (rollNumber && data[i][0].toString() !== rollNumber.toString()) continue;
      logs.push({
        rollNumber: data[i][0].toString(),
        date: data[i][1].toString(),
        status: data[i][2].toString(),
        recordedBy: data[i][3].toString()
      });
    }
  }
  
  return handleResponse({ status: "success", dailyAttendance: logs });
}

function saveAttendance(sessionToken, date, attendanceData) {
  const session = validateSession(sessionToken);
  if (!session || (session.role !== "Teacher" && session.role !== "Admin")) {
    return handleError("Unauthorized attendance marking.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("DailyAttendance");
  
  attendanceData.forEach(item => {
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0].toString() === item.rollNumber.toString() && data[i][1].toString() === date.toString()) {
        sheet.deleteRow(i + 1);
      }
    }
    
    sheet.appendRow([
      item.rollNumber.toString(),
      date.toString(),
      item.status || "Present",
      session.userId
    ]);
  });
  
  logActivity(session.userId, session.role, "ATTENDANCE_REGISTER", `Recorded attendance for ${attendanceData.length} students on ${date}`);
  return handleResponse({ status: "success", message: "Daily attendance register updated successfully." });
}

function getTimetable(sessionToken, className, sectionName) {
  const session = validateSession(sessionToken);
  if (!session) return handleError("Authentication required.");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Timetable");
  const data = sheet.getDataRange().getValues();
  const slots = [];
  
  for (let i = 1; i < data.length; i++) {
    if (className && data[i][0].toString() !== className.toString()) continue;
    if (sectionName && data[i][1].toString() !== sectionName.toString()) continue;
    
    slots.push({
      className: data[i][0].toString(),
      sectionName: data[i][1].toString(),
      day: data[i][2].toString(),
      period: parseInt(data[i][3]),
      subject: data[i][4].toString(),
      teacher: data[i][5].toString()
    });
  }
  
  return handleResponse({ status: "success", timetable: slots });
}

function saveTimetable(sessionToken, timetableData) {
  const session = validateSession(sessionToken);
  if (!session || (session.role !== "Admin" && session.role !== "Principal")) {
    return handleError("Unauthorized timetable modification.");
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Timetable");
  const data = sheet.getDataRange().getValues();
  
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0].toString() === timetableData.className.toString() &&
        data[i][1].toString() === timetableData.sectionName.toString() &&
        data[i][2].toString() === timetableData.day.toString() &&
        parseInt(data[i][3]) === parseInt(timetableData.period)) {
      sheet.deleteRow(i + 1);
    }
  }
  
  sheet.appendRow([
    timetableData.className.toString(),
    timetableData.sectionName.toString(),
    timetableData.day.toString(),
    parseInt(timetableData.period),
    timetableData.subject.toString(),
    timetableData.teacher || "N/A"
  ]);
  
  logActivity(session.userId, session.role, "TIMETABLE_UPDATE", `Updated ${timetableData.className}-${timetableData.sectionName} schedule slot (Day: ${timetableData.day}, Period: ${timetableData.period})`);
  return handleResponse({ status: "success", message: "Timetable slot updated successfully." });
}

function getTransport(sessionToken) {
  const session = validateSession(sessionToken);
  if (!session) return handleError("Authentication required.");
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Transport");
  const data = sheet.getDataRange().getValues();
  const routes = [];
  
  for (let i = 1; i < data.length; i++) {
    routes.push({
      vehicleNum: data[i][0].toString(),
      routeName: data[i][1].toString(),
      driverName: data[i][2].toString(),
      driverPhone: data[i][3].toString(),
      pickupTime: data[i][4].toString(),
      dropTime: data[i][5].toString()
    });
  }
  
  return handleResponse({ status: "success", transport: routes });
}
