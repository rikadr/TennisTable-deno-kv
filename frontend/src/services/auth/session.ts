const JWT_TOKEN_NAME = "jwt-token";

export const session = {
  get token() {
    return localStorage.getItem(JWT_TOKEN_NAME) ?? undefined;
  },

  set token(value: string | undefined) {
    if (value === undefined) {
      localStorage.removeItem(JWT_TOKEN_NAME);
    } else {
      localStorage.setItem(JWT_TOKEN_NAME, value);
    }
  },

  get isAuthenticated() {
    return this.token !== undefined;
  },
};
