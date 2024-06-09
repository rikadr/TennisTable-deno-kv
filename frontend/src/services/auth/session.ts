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

  get sessionData() {
    if (this.token === undefined) {
      return undefined;
    }

    const parsed: { exp: number; role: string; username: string } = parseJwt(this.token);
    return {
      expires: new Date(parsed.exp * 1000),
      role: parsed.role,
      username: parsed.username,
    };
  },
};

function parseJwt(token: string) {
  var base64Url = token.split(".")[1];
  var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  var jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );

  return JSON.parse(jsonPayload);
}
