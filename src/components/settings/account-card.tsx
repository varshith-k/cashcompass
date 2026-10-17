"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/provider";

export function AccountCard() {
  const { user, status, logoutHref } = useAuth();
  const initials = user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <Avatar className="size-12">
          <AvatarFallback className="bg-brand-navy text-white">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{user?.name}</p>
          <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {status === "authenticated" ? "Demo account" : "Signed out"}
        </Badge>
      </CardContent>
      <CardContent className="pt-0">
        <Button render={<a href={logoutHref}>Sign out</a>} nativeButton={false} variant="outline" size="sm" />
      </CardContent>
    </Card>
  );
}
