// In-memory user store (Zero disk persistence for sensitive credentials)
const users = new Map();

export const UserDB = {
  findByEmail: (email) => users.get(email.toLowerCase()),
  
  createUser: (email, passwordHash) => {
    const newUser = {
      email: email.toLowerCase(),
      passwordHash,
      mfaSecret: null,
      mfaEnabled: false,
      step3Token: null
    };
    users.set(email.toLowerCase(), newUser);
    return newUser;
  },

  updateUser: (email, updates) => {
    const user = users.get(email.toLowerCase());
    if (user) {
      Object.assign(user, updates);
      users.set(email.toLowerCase(), user);
    }
    return user;
  }
};