export default async function handler(req, res) {
    const LAMBDA_URL = "http://localhost:8080/api/students";

    try {
        if (req.method === 'GET') {
            const response = await fetch(LAMBDA_URL, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const data = await response.text();
            res.status(200).json({ success: true, data });
        }
        else {
            res.status(405).json({ success: false, error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }  
}