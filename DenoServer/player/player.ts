import { kv } from "../db.ts";

export type Player = { name: string };
export type CreatePlayerPayload = { name: string };

export async function getPlayer(name: string): Promise<Player | null> {
  if (!name) {
    throw new Error("name is required");
  }
  const res = await kv.get<Player>(["player", name]);

  if (res.value) {
    return res.value;
  }
  return null;
}

export async function getAllPlayers(): Promise<Player[]> {
  const players: Player[] = [];
  const res = kv.list<Player>({ prefix: ["player"] });

  for await (const player of res) {
    players.push(player.value);
  }
  return players;
}

export async function createPlayer(payload: CreatePlayerPayload): Promise<Player> {
  if (!payload.name) {
    throw new Error("name is required");
  }
  const key = ["player", payload.name];
  const value: Player = { name: payload.name };

  const res = await kv.atomic().check({ key, versionstamp: null }).set(key, value).commit();

  if (res.ok) {
    return value;
  } else {
    throw new Error("Failed to create player");
  }
}

export async function deletePlayer(name: string) {
  if (!name) {
    throw new Error("name is required");
  }
  await kv.delete(["player", name]);
}

export async function uploadProfilePicture(name: string, base64: string) {
  if (!name) {
    throw new Error("name is required");
  }

  if (!base64) {
    throw new Error("base64 is required");
  }

  const res = await kv.set(["profile-picture", name], base64);

  if (res.ok) {
    return;
  } else {
    throw new Error("Failed to upload profile picture");
  }
}

export async function getProfilePicture(name: string): Promise<string | null> {
  if (!name) {
    throw new Error("name is required");
  }

  const res = await kv.get(["profile-picture", name]);

  if (res.value) {
    return res.value as string;
  }
  return null;
}

export const DEFAULT_PROFILE_PHOTO =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCADIAMgDASIAAhEBAxEB/8QAGwABAAIDAQEAAAAAAAAAAAAAAAUGAwQHAgH/xAA+EAACAgECAgYHBQYFBQAAAAAAAQIDBAURBiESMUFRcdETIjJhkaHBFFJygbEVFiNEYuEkM0JTklRjg6Ky/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AOzAAAAAAAAAAADzOcK4uc5KMVzbb2SIzJ4l0vGbSvd0l2VLf59XzAlQVe7jOKltRhNrvnPb5JGrPjHPb9SiiK96b+oFyBSf3v1L7mP/AMH5mSvjHNT/AImPRJf0pr6sC5ArNHGdTe1+HOK74SUv12JPG4h0vK5RyVXLut9X5vkBJg+JprdPdH0AAAAAAAAAAAAAAAAAARer67j6XDocrchrlWn1e99wEhfkU41TtvsjXBdcpPYrWocX83Xp9W//AHbF+i8/gV/O1DJ1G70uTY5P/TFcox8EawGfKzcrNn0sm+dr/qfJeC6kYAAAAAAAAAANrD1LMwJb42ROC+7vvF/l1Fk07i6q3avOr9FL/chzj8OtfMqIA6hXZC2CsrnGcJLdSi90z0c703V8rS7N6Z71t+tXL2X5P3l10vV8bVKelU+jZFevW+uPmveBvgAAAAAAAAAAARWvaxHS8Xo1tPIsW0F3e9gYNf1+OnxeNjNSyZLm+tV/3KXOyVk5TnJylJ7uTe7bE5ysm5zk5Sk922922eQAAAAAADc0/SsvU59HHr9Ve1OXKK/MseLwfiwSeTfZbLtUfVXmBUAXr91tK229DPx9IzRy+DqnFyw8iUZdkbOa+K6gKmDYzcDJ0+70WTU4PsfZLwZrgAAAMmPkW4t8bqJuFkXumjGAL9outV6rT0ZbQyIL14d/vXuJQ5jj5FuLfC+mbhZB7po6BpOp1aphxuhsprlZD7r8gN4AAAAAAAGLJyK8TGsyLZbQrW7OdZ+bbqGZPJtfOT5L7q7ET3F+o9KyGn1y5R9e3bv7F9fgVkAAAAAAEjoulT1XM6DbjTDnZJd3cveyOL9w7hrD0enkuncvSSfj1fLYCQooqxqY00wUIRWyijIAAAAGvm4VGfjSoyIdKL6n2xfejn+pYFum5s8azntzjL70exnSCB4two3aaspJdOiS598Xy2+OwFLAAAAADf0bU56XnRt3bql6tke9d/ijQAHUITjZCM4SUoyW6a6mj0V7hLUfT4ssKyW86ecPfH+z/VFhAAAAeLrY0Uztm9oQi5SfuR7IbinK+z6PKCbUrpKHLu63+nzApeVkTy8qzIs9qyTk+fV7jEAAAAAAADqEIqEFGK2UVsl3HLzpOn5Ky9PoyE03ZBN7d/b89wNkAAAAANPVoqWkZia3/gzfwTZuEZxDkrG0TIe6UrF6OKfbvyfy3AoAAAAAAAAN3SM14Gp0377QUujP8L6/P8johy46HomT9r0fHtbbkodGTfXuuX0A3wAAKnxndvfjUJ+zFza8Xsv0ZbCkcWz6Ws7fdqiv1f1AhAAAAAAAACz8J6rGG+nXS23fSqb+a+vxKwfYycZKUW009012AdRBWdI4qhOMaNQfQmuSuS5Px7ix1213QU6pxnF9UovdMD2AYr8inGrdl9sK4rtk9gMpSuKNVjm5SxaZb00Pm11Sl/bzNjWeKHdGWPp7cYPlK18m/Du8StAAAAAAAAAC4cHX9PAvpb3ddm68Gv7Mp5ZeDJ7X5UN+uMX8G/MC2gAAUPiff9vX790f/lF8KRxbDo61v9+qL/VfQCEAAAAAAAABIabomZqb6VUOhV22T5L8u8s+Hwrp+Ok7lLIn3z5L4L67gUmMZTl0Yxcn3Jbm7jYmq1vp41GXB98IyR0CqimiPRpqhWu6EUjIBRn+8m23+O/9jRyMPUnJzyMfJk+2U4SfzOjgDlrTT2a2a7GDpl+Lj5K2vorsX9cUyGzeEsO9OWLKWPPsW/Sj8+YFMBuahpWXplnRyK/VfszjzjL8zTAAAAAABYODt/2ld3eh+qK+WXgyG+RlT7oRXxb8gLaAABUuM6dsjGv29qDi/wAnv9S2kJxXjen0h2LfemalyXZ1P9fkBSAAAAAAn+HtA+27ZeVFqhP1Y/ffkRukYD1LUa8fmoe1Nrsiuvy/M6HCEa64whFRjFbJLsQCMYwioxioxS2SS2SR6AAAAAAAAAAx3U15FUqroKcJLZxkuTKRruiS0u1WVbyxpv1W+uL7mXsw5WNXmY1mPct4WLZgczBmzMWzCy7caz2q5bb9/czCAAAAt/BtPRwsi5r27FH4L+5UDoOhY32XRseD9qUem912vn9QJEAADHfTHIx7KZ+zZFxfgzIAOY5FM8bIsosW065OL/Ixlk4u0/0eRDPhH1bPVs90l1P81+hWwAAAt3B2IoYl2U161kujF+5f3fyLIR2gVei0PFXfDpfF7/UkQAAAAAAAAAAAAACo8Y4qhkUZUV/mRcJeK6v1+RWy7cW1dPRunt/l2Rf0+pSQAAA29Lw3n6lTj7bxlLeX4VzfyOjJbLYrnCOnuqiedZH1rfVh+Fdb/N/oWQAAAAAAwZmLXm4lmNavUsW3h3M51mYluDlWY1y2nB7e5+86YQ/EGjLUsf0tKX2mper/AFLu8gKKD604ycZJpp7NPsPgHR9L2/ZWJ0WmvQw6vBG2c6wdYztOXRx7mob79CXOJM0cZ2rZX4cJd7hJr5PcC2Ar8OMcF+3RfHwSf1NiPFWlSXO2cfGt/QCYBFLiXSH/ADXxrl5HpcQ6S/5yP/F+QEmCN/eDSv8ArIfB+R8fEWkr+cj/AMZeQEmCKfEukL+a38K5eRjnxVpcV6tlk/w1v6gTIK7PjLDXsY18n79l9TSv4yyZJqjFrr98m5eQE1xK4/sHI3a59Hbf8SKEbOZqOXqElLJvlPbqj1JfkawA3dK06ep50KI7qHXZL7se01aabL7Y1VQc5ze0Uu0v+jaVDSsNV8pWz52TXa+7wQG7XXCquNdcVGEEoxS7Ej2AAAAAAAAABXuIOH/tfSy8OKV69uC/1+/xKe04ycZJpp7NPsOokNrPD1OpJ3VNVZP3uyXj5gUYGbLw8jBudOTU65rv6n4PtMIAAAAAAAAAAAAAAPdVVl9saqoOc5PaMUubM+BpuVqV3o8evfb2pvlGPiy7aTomPpVe8f4l0l61jXPwXcgMOhaFDTK/TXbTyZrm+yC7l5kwAAAAAAAAAAAAAAAYMrDx82l1ZNUbIPv7PB9hWNQ4RurbswLPSx/25vaS8H1P5FuAHMbse7Gs9HfVOufdJbGM6ddRTkQ6F1ULIvsnHdERk8Kabe961ZQ/6Jbr4PcCkAst3Bly/wAjLhL3Ti4+Zqz4S1OPV6Gf4Z+aAhAS/wC6+rb7egj4+kj5mWHCWpy9p0Q8Zv6ICDBZ6eDJtp35kUu1Qhv82SeLwvpmPs5Vyvkn12S3+S5AUvGw8nMn0Maidr7eiuS8X2Fj07hDmrNQs/8AFW/1fl8SzV1wqgoVwjCK6oxWyR6A8UUVY1Uaqa41wj1RitkZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//Z";
