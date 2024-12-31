import bcrypt from 'bcrypt';

export interface User {
    id: string;
    username: string;
    password: string; // Hashed password
}

const users: User[] = []; // Temporary in-memory storage (use a database in production)

// Create a new user with a hashed password
export async function createUser(username: string, password: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
    const user: User = { id: generateUserId(), username, password: hashedPassword };
    users.push(user);
    return user;
}

// Authenticate a user with username and password
export async function authenticateUser(username: string, password: string): Promise<User | null> {
    const user = users.find((u) => u.username === username);
    if (user && await bcrypt.compare(password, user.password)) {
        return user;
    }
    return null;
}

// Generate a unique ID for users
function generateUserId(): string {
    return Math.random().toString(36).substring(2, 9);
}
