import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const JWT_SECRET = process.env.JWT_SECRET || "BuiNamKhanh_SecretKey_BaoVeDoAn2026";

// ✅ ĐỊNH NGHĨA KHUÔN (INTERFACE) CHO TOKEN
// Việc này giúp TypeScript hiểu payload có chứa id, username và roles
interface MyJwtPayload extends jwt.JwtPayload {
    id: string;
    username: string;
    roles: string[];
}

// Logger kiểm soát luồng
app.use((req: Request, res: Response, next) => {
    console.log(`>>> [AUTH-INTERNAL] ${req.method} ${req.url}`);
    next();
});

// --- 1. ROUTE ĐĂNG KÝ ---
app.post("/register", async (req: Request, res: Response) => {
    const { username, email, password, role, full_name } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Thiếu thông tin đăng ký" });

    const client = await pool.connect();
    try {
        const hash = await bcrypt.hash(password, 10);
        await client.query('BEGIN');
        
        const userRes = await client.query(
            "INSERT INTO users(username, email, password_hash, full_name) VALUES($1, $2, $3, $4) RETURNING id",
            [username, email || null, hash, full_name || username]
        );
        const userId = userRes.rows[0].id;

        const roleName = role || "student";
        const roleRes = await client.query("SELECT id FROM roles WHERE name=$1", [roleName]);
        
        if (roleRes.rows[0]) {
            await client.query(
                "INSERT INTO user_roles(user_id, role_id) VALUES($1, $2)",
                [userId, roleRes.rows[0].id]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ message: "Đăng ký thành công" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: "Tài khoản đã tồn tại hoặc lỗi hệ thống" });
    } finally {
        client.release();
    }
});

// --- 2. ROUTE ĐĂNG NHẬP ---
app.post("/login", async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;
        const r = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
        const user = r.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(400).json({ error: "Sai tài khoản hoặc mật khẩu" });
        }

        const rolesQ = await pool.query(
            "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id=r.id WHERE ur.user_id=$1",
            [user.id]
        );
        const roles = rolesQ.rows.map((x: any) => x.name);

        const token = jwt.sign(
            { id: user.id, username: user.username, roles }, 
            JWT_SECRET, 
            { expiresIn: "6h" }
        );

        res.json({ 
            access_token: token, 
            user: { 
                id: user.id, 
                username: user.username, 
                full_name: user.full_name || user.username,
                roles 
            } 
        });
    } catch (err) {
        res.status(500).json({ error: "Lỗi Server" });
    }
});

// --- 3. THÔNG TIN CÁ NHÂN (HẾT LỖI TS2339 & TS2698) ---
app.get("/me", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });
    try {
        // ✅ ÉP KIỂU SANG MyJwtPayload ĐỂ TRUY CẬP .id VÀ SPREAD OBJECT
        const payload = jwt.verify(token, JWT_SECRET) as MyJwtPayload;
        
        const r = await pool.query("SELECT email, full_name FROM users WHERE id=$1", [payload.id]);
        const dbUser = r.rows[0];

        res.json({ 
            ...payload, 
            email: dbUser?.email || "", 
            full_name: dbUser?.full_name || payload.username 
        });
    } catch {
        res.status(401).json({ error: "Invalid token" });
    }
});

// --- 4. DANH SÁCH USER ---
app.get("/users", async (req: Request, res: Response) => {
    try {
        const r = await pool.query(`
            SELECT u.id, u.username, u.email, u.full_name, r.name as role
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            ORDER BY u.id DESC
        `);
        res.json(r.rows);
    } catch (err) { 
        res.status(500).json({ error: "Lỗi lấy danh sách user" }); 
    }
});

// --- 5. ĐỔI MẬT KHẨU ---
app.put("/change-password", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "No token" });

    try {
        const payload = jwt.verify(token, JWT_SECRET) as MyJwtPayload;
        const { oldPassword, newPassword } = req.body;

        const r = await pool.query("SELECT password_hash FROM users WHERE id=$1", [payload.id]);
        const user = r.rows[0];
        if (!user) return res.status(404).json({ message: "User không tồn tại" });

        const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isMatch) return res.status(400).json({ message: "Mật khẩu cũ không đúng" });

        const newHash = await bcrypt.hash(newPassword, 10);
        await pool.query("UPDATE users SET password_hash=$1 WHERE id=$2", [newHash, payload.id]);

        res.json({ message: "Cập nhật mật khẩu thành công" });
    } catch (err) {
        res.status(500).json({ message: "Lỗi Server hoặc Token không hợp lệ" });
    }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`🔐 Auth Service (Internal) flying on ${port}`));