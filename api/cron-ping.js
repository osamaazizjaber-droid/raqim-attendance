export default async function handler(req, res) {
  const renderUrl = process.env.RENDER_BOT_URL || 'https://raqim-attendance.onrender.com';
  
  console.log(`Cron-ping triggered. Pinging Render Bot URL: ${renderUrl}`);
  try {
    const response = await fetch(renderUrl);
    const text = await response.text();
    return res.status(200).json({
      success: true,
      status: response.status,
      message: 'Render Bot pinged successfully to prevent sleeping.',
      response: text.substring(0, 100)
    });
  } catch (err) {
    console.error('Failed to ping Render Bot:', err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
