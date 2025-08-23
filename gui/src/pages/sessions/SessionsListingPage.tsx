import { useGetSessionsListQuery } from "@/app/services/session.service";
import React from "react";

const SessionsListingPage = () => {
  const { data, isLoading, isError, error, refetch } =
    useGetSessionsListQuery();

  if (isLoading) return <div>Loading...</div>;
  if (isError) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>Sessions Listing</h1>
      <ul>
        {data.sessions.map((session) => (
          <li key={session.id}>{session.metadata.url}</li>
        ))}
      </ul>
    </div>
  );
};

export default SessionsListingPage;
