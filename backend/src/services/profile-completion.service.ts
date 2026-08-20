import { prisma } from '../config/db.js';

export async function getProfileCompletion(userId: string) {
  const [profile, photoCount, interestCount, promptCount] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.photo.count({ where: { userId } }),
    prisma.userInterest.count({ where: { userId } }),
    prisma.prompt.count({ where: { userId } }),
  ]);

  const missing: string[] = [];
  if (!profile) {
    missing.push('profile');
  } else {
    if (!profile.displayName.trim()) missing.push('displayName');
    if (!profile.bio || profile.bio.trim().length < 20) missing.push('bio');
    if (!profile.city?.trim()) missing.push('city');
  }
  if (photoCount < 1) missing.push('photo');
  if (interestCount < 3) missing.push('interests');
  if (promptCount < 1) missing.push('prompt');

  const checks = 6;
  const completed = checks - missing.length;
  const percent = Math.max(0, Math.min(100, Math.round((completed / checks) * 100)));
  const complete = missing.length === 0;

  if (profile && complete !== Boolean(profile.profileCompletedAt)) {
    await prisma.profile.update({
      where: { userId },
      data: { profileCompletedAt: complete ? new Date() : null },
    });
  }

  return { complete, percent, missing, photoCount, interestCount, promptCount };
}
