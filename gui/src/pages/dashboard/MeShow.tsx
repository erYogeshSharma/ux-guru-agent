import React from "react";
import { useGetProfileQuery } from "@/app/services/user.service";
import type { User } from "@/@types/auth";

export const Profile: React.FC = () => {
  // call the hook (no args because your endpoint is builder.query<MeResponse, void>)
  const { data, isLoading, isError, error, refetch } = useGetProfileQuery();

  // data is MeResponse | undefined; user is possibly undefined
  const user: User | undefined = data?.user;

  if (isLoading) return <div>Loading user...</div>;
  if (isError) {
    const formatError = (err: unknown) => {
      if (!err) return "Unknown error";
      // common RTK Query error shapes
      if (typeof err === "string") return err;
      if (err instanceof Error) return err.message;
      try {
        return JSON.stringify(err);
      } catch {
        return String(err);
      }
    };

    return <div>Error loading user: {formatError(error)}</div>;
  }

  return (
    <div>
      <h2>Profile</h2>
      {user ? (
        <div>
          <p>
            <strong>ID:</strong> {user?.id}
          </p>
          <p>
            <strong>Name:</strong> {user?.name}
          </p>
          <p>
            <strong>Email:</strong> {user?.email}
          </p>
          <pre>{JSON.stringify(user, null, 2)}</pre>
        </div>
      ) : (
        <div>No user data</div>
      )}
      <button onClick={() => refetch?.()}>Refresh</button>
    </div>
  );
};
