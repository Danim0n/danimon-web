-- Read-only reports. UTC; all totals are actions, not people.
-- Buttons: last 30 calendar days including today.
SELECT counter, SUM(total) AS actions FROM daily_counts
WHERE day >= date('now','-29 days') GROUP BY counter ORDER BY actions DESC;

-- Projects: distinct action types, not a combined conversion funnel.
SELECT project,counter,SUM(total) AS actions FROM daily_counts
WHERE project <> 'none' AND day >= date('now','-29 days')
GROUP BY project,counter ORDER BY project,actions DESC;

-- Daily evolution.
SELECT day,counter,SUM(total) AS actions FROM daily_counts
WHERE day >= date('now','-29 days') GROUP BY day,counter ORDER BY day,counter;

-- Monday-based UTC weeks.
SELECT date(day,'-' || ((CAST(strftime('%w',day) AS INTEGER)+6)%7) || ' days') AS week_start,
counter,SUM(total) AS actions FROM daily_counts
GROUP BY week_start,counter ORDER BY week_start DESC,counter;

-- Calendar months.
SELECT substr(day,1,7) AS month,counter,SUM(total) AS actions FROM daily_counts
GROUP BY month,counter ORDER BY month DESC,counter;

-- Download intention vs prepared PDF HTTP 200 (not transfer completion).
SELECT counter,SUM(total) AS actions FROM daily_counts
WHERE counter IN ('cv_download_clicked','cv_response_served')
AND day >= date('now','-29 days') GROUP BY counter;

-- Page and language breakdown.
SELECT page,language,counter,SUM(total) AS actions FROM daily_counts
WHERE day >= date('now','-29 days') GROUP BY page,language,counter ORDER BY actions DESC;

