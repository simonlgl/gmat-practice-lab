import type { AbilityMap, Attempt, FriendSnapshot, UserProfile } from "./types";

export type CloudAuthResponse =
  | {
      ok: true;
      token: string;
      profile: UserProfile;
      friends: FriendSnapshot[];
      ability?: AbilityMap;
      recoveryCode?: string;
    }
  | {
      ok: false;
      error: string;
      localFallback?: boolean;
    };

export type CloudFriendsResponse =
  | {
      ok: true;
      friends: FriendSnapshot[];
    }
  | {
      ok: false;
      error: string;
    };

export type CloudProgressPayload = {
  token: string;
  attempt: Attempt;
  ability: AbilityMap;
};

export type CloudSnapshotResponse =
  | {
      ok: true;
      profile: UserProfile;
      friends: FriendSnapshot[];
      ability?: AbilityMap;
    }
  | {
      ok: false;
      error: string;
    };

export type CloudProfileResponse =
  | {
      ok: true;
      profile: UserProfile;
      friends: FriendSnapshot[];
    }
  | {
      ok: false;
      error: string;
    };
