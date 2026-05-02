const express = require("express");
require("dotenv").config();
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const xlsx = require("xlsx");
const fs = require("fs");
const Transaction = require("./models/transaction");
const auth = require("./middleware/auth");
const Session = require("./models/session");
const billRoutes = require("./routes/bill");
const Bill = require("./models/bill");

const bcrypt = require("bcrypt");
const { nanoid } = require("nanoid");
const cookieParser = require("cookie-parser");
//const sessions = require("./sessionStore")

const connect = require("./connection");
const collection = require("./mongoose");

const cron = require("node-cron");

let uploadQueue = [];
let isRunning = false;

const app = express();

connect()
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((err) => {
    console.error("MongoDB error:", err);
  });

const allowedOrigins = ["http://localhost:5173", process.env.CLIENT_URL];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use("/transaction", require("./routes/transaction"));
app.use("/uploads", express.static("uploads"));
app.use("/api/bills", billRoutes);
app.use("/api/budget", require("./routes/budget"));

//app.use("/income", require("./routes/income"))
//app.use("/expense", require("./routes/expense"))

function formatDate(dateInput) {
  if (!dateInput) return new Date().toISOString().split("T")[0];

  // Handle Excel string dates like 1/19/26
  if (typeof dateInput === "string" && dateInput.includes("/")) {
    const [month, day, year] = dateInput.split("/");
    const fullYear = year.length === 2 ? "20" + year : year;

    return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Handle normal ISO / Date objects
  const date = new Date(dateInput);
  if (isNaN(date)) return null;

  return date.toISOString().split("T")[0];
}
const validateRow = (item, index) => {
  let errors = [];

  // DATE validation
  if (!item.Date) {
    errors.push(`Row ${index + 1}: Date is required`);
  } else {
    const formattedDate = formatDate(item.Date);

    if (!formattedDate) {
      errors.push(`Row ${index + 1}: Invalid date format`);
    } else {
      const inputDate = new Date(formattedDate);
      const today = new Date();

      if (inputDate > today) {
        errors.push(`Row ${index + 1}: Date cannot be in future`);
      }
    }
  }

  // TYPE validation (income / expense)
  if (!item.Type || !["income", "expense"].includes(item.Type.toLowerCase())) {
    errors.push(`Row ${index + 1}: Type must be 'income' or 'expense'`);
  }

  // CATEGORY validation (not null)
  if (!item.Category || item.Category.toString().trim() === "") {
    errors.push(`Row ${index + 1}: Category is required`);
  }

  // AMOUNT validation
  if (!item.Amount || isNaN(Number(item.Amount))) {
    errors.push(`Row ${index + 1}: Amount must be a number`);
  } else if (Number(item.Amount) <= 0) {
    errors.push(`Row ${index + 1}: Amount must be positive`);
  }

  // STRING FIELDS validation (allow number but convert)
  ["Details", "Source", "Payment", "To"].forEach((field) => {
    if (item[field] !== undefined && item[field] !== null) {
      if (typeof item[field] !== "string" && typeof item[field] !== "number") {
        errors.push(`Row ${index + 1}: ${field} must be string or number`);
      }
    }
  });

  return errors;
};
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const path = `./uploads/`;
    fs.mkdirSync(path, { recursive: true });
    cb(null, path);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    if (ext !== ".xlsx" && ext !== ".xls") {
      return cb(new Error("Only Excel files (.xlsx, .xls) allowed"));
    }
    cb(null, true);
  },
});

//UPLOAD route
app.post("/upload", auth, (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: "File format not supported",
        error: err,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }
    try {
      const filePath = `./uploads/${req.file.filename}`;

      console.log("FILE RECEIVED:", req.file.filename);
      console.log("USER:", req.user);

      const workbook = xlsx.readFile(filePath, { cellDates: true });

      let data = [];
      let validData = [];
      let invalidData = [];

      const sheets = workbook.SheetNames;

      for (let i = 0; i < sheets.length; i++) {
        const temp = xlsx.utils.sheet_to_json(workbook.Sheets[sheets[i]], {
          raw: false,
        });
        data.push(...temp);
      }

      console.log("TOTAL RECORDS:", data.length);
      console.log("SAMPLE DATA:", data[0]);

      if (data.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Excel file is empty",
        });
      }

      const uploadedBills = new Set();

      for (let index = 0; index < data.length; index++) {
        const item = data[index];
        let errors = validateRow(item, index);

        if (
          item.Category &&
          item.Category.toString().trim().toLowerCase() === "bills"
        ) {
          const billName = item.To?.toString().trim().toLowerCase();
          const formattedDate = formatDate(item.Date);
          const currentMonth = formattedDate?.slice(0, 7);

          if (!billName) {
            errors.push(`Row ${index + 1}: Bill name missing`);
          } else {
            const uniqueKey = `${billName}-${currentMonth}`;

            // duplicate inside same upload
            if (uploadedBills.has(uniqueKey)) {
              errors.push(`Row ${index + 1}: Bill already exists in upload`);
            } else {
              uploadedBills.add(uniqueKey);

              // duplicate in DB for same month
              const existingBill = await Bill.findOne({
                name: billName, // ✅ FIXED
                user: req.user.email,
                dueDate: {
                  $regex: `^${currentMonth}`,
                },
              });

              if (existingBill) {
                errors.push(
                  `Row ${index + 1}: Bill already exists for this month`,
                );
              }
            }
          }
        }

        if (errors.length > 0) {
          invalidData.push({
            row: index + 1,
            errors,
            data: item,
          });
        } else {
          validData.push(item);
        }
      }

      console.log("Total Records:", data.length);
      console.log("Valid Records:", validData.length);
      console.log("Invalid Records:", invalidData.length);

      const batchSize = 5;
      for (let i = 0; i < validData.length; i += batchSize) {
        const batch = validData.slice(i, i + batchSize);

        uploadQueue.push({
          user: req.user.email,
          data: batch,
        });
      }
      fs.unlink(filePath, (err) => {
        if (err) console.log("File delete error:", err);
      });

      res.json({
        success: true,
        message: "File uploaded and queued for processing",
        totalRecords: data.length,
        validRecords: validData.length,
        invalidRecords: invalidData.length,
        batchesCreated: Math.ceil(validData.length / batchSize),
        errors: invalidData,
      });
    } catch (err) {
      console.log("UPLOAD ERROR:", err);

      res.status(500).json({
        success: false,
        message: err.message || "Server error",
      });
    }
  });
});

// LOGIN ROUTE
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await collection.findOne({ email: email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    const sessionId = nanoid();
    await Session.create({
      sessionId,
      email: user.email,
    });
    //res.cookie(name, value [, options])
    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// SIGNUP ROUTE
app.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;

  try {
    const check = await collection.findOne({ email: email });

    if (check) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const data = {
      email,
      password: hashedPassword,
      name,
    };

    await collection.insertMany([data]);

    return res.status(201).json({
      success: true,
      message: "Signup successful",
    });
  } catch (e) {
    console.log(e);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// LOGOUT ROUTE
app.post("/logout", async (req, res) => {
  const sessionId = req.cookies.sessionId;

  if (sessionId) {
    await Session.deleteOne({ sessionId });
  }

  res.clearCookie("sessionId", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

//Job Scheduling
cron.schedule("*/5 * * * * *", async () => {
  if (isRunning || uploadQueue.length === 0) return;

  isRunning = true;

  const job = uploadQueue.shift();
  const batch = job.data;

  const formattedBatch = batch.map((item) => ({
    date: formatDate(item.Date),
    type: item.Type?.toLowerCase() === "income" ? "income" : "expense",
    category: item.Category,
    amount: Number(item.Amount),
    payment: item.Payment,
    source: item.Source,
    to: item.To,
    user: job.user,
  }));

  try {
    for (const item of formattedBatch) {
      await Transaction.create(item);

      if (item.category.toLowerCase() === "bills") {
        const today = item.date;
        const currentMonth = today.slice(0, 7);
        const cleanName = item.to?.toString().trim().toLowerCase();

        const existingBill = await Bill.findOne({
          name: cleanName,
          user: item.user,
          dueDate: {
            $regex: `^${currentMonth}`,
          },
        });

        //  prevent closed bill recreation
        const closedBill = await Bill.findOne({
          name: cleanName,
          user: item.user,
          status: "closed",
        });

        if (closedBill) {
          continue; // skip this bill completely
        }

        if (existingBill) {
          // already exists → mark paid
          existingBill.status = "paid";
          existingBill.lastPaidDate = today;
          existingBill.lastPaidMonth = currentMonth;

          await existingBill.save();
        } else {
          // 🔥 CHECK previous unpaid bill
          const previousMonthDate = new Date(today);
          previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);

          const prevMonth = previousMonthDate.toISOString().slice(0, 7);

          const oldUnpaid = await Bill.findOne({
            name: cleanName,
            user: item.user,
            dueDate: { $regex: `^${prevMonth}` },
            status: "unpaid",
          });

          // create new bill
          await Bill.create({
            name: cleanName,
            amount: item.amount,
            paymentMethod: item.payment?.toUpperCase() || "UPI",
            category: "Bills",
            dueDate: today,
            frequency: "Monthly",
            status: "paid",
            lastPaidDate: today,
            lastPaidMonth: currentMonth,
            user: item.user,
          });
        }
      }
    }
    console.log("Batch inserted");
  } catch (err) {
    console.log(err.message);
  }

  isRunning = false;
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
