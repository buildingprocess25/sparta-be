/**
 * Script untuk testing endpoint proxy-file
 * 
 * Usage:
 * 1. Pastikan server running: npm run dev
 * 2. Get sample URL dari database denda_keterlambatan_action.lampiran_1_url
 * 3. Update SAMPLE_URL di bawah
 * 4. node test-proxy-file.js
 */

const https = require('https');
const http = require('http');

// ============================================================================
// CONFIGURATION - UPDATE INI!
// ============================================================================

const API_BASE_URL = 'http://localhost:8082';  // Adjust ke port server Anda
const SAMPLE_DRIVE_URL = 'https://drive.google.com/file/d/YOUR_FILE_ID_HERE/view';  // Update dengan URL asli dari DB

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

function testProxyFile(driveUrl) {
    return new Promise((resolve, reject) => {
        const encodedUrl = encodeURIComponent(driveUrl);
        const proxyUrl = `${API_BASE_URL}/api/denda/actions/proxy-file?url=${encodedUrl}`;
        
        console.log('\n===========================================');
        console.log('🧪 Testing Proxy File Endpoint');
        console.log('===========================================');
        console.log('Drive URL:', driveUrl);
        console.log('Proxy URL:', proxyUrl);
        console.log('-------------------------------------------\n');

        const protocol = proxyUrl.startsWith('https') ? https : http;
        
        const req = protocol.get(proxyUrl, (res) => {
            console.log('✅ Response received');
            console.log('Status Code:', res.statusCode);
            console.log('Status Message:', res.statusMessage);
            console.log('Headers:', JSON.stringify(res.headers, null, 2));
            
            let data = [];
            
            res.on('data', (chunk) => {
                data.push(chunk);
            });
            
            res.on('end', () => {
                const totalBytes = data.reduce((acc, chunk) => acc + chunk.length, 0);
                console.log('\n📊 Summary:');
                console.log('- Total bytes received:', totalBytes);
                console.log('- Content-Type:', res.headers['content-type']);
                console.log('- Content-Disposition:', res.headers['content-disposition']);
                
                if (res.statusCode === 200) {
                    console.log('\n✅ SUCCESS: File proxied successfully!');
                    resolve({ success: true, statusCode: res.statusCode, bytes: totalBytes });
                } else {
                    console.log('\n❌ FAILED: Status code is not 200');
                    const body = Buffer.concat(data).toString();
                    console.log('Response body:', body);
                    resolve({ success: false, statusCode: res.statusCode, body });
                }
            });
        });

        req.on('error', (error) => {
            console.error('\n❌ Request error:', error.message);
            reject(error);
        });

        req.setTimeout(30000, () => {
            console.error('\n❌ Request timeout after 30s');
            req.destroy();
            reject(new Error('Timeout'));
        });
    });
}

// ============================================================================
// GET SAMPLE URL FROM DATABASE
// ============================================================================

async function getSampleUrlFromDb() {
    // Jika Anda punya pg client, bisa query:
    // SELECT lampiran_1_url FROM denda_keterlambatan_action WHERE lampiran_1_url IS NOT NULL LIMIT 1;
    
    console.log('\n📋 To get sample URL, run this SQL:');
    console.log('-------------------------------------------');
    console.log('SELECT id, lampiran_1_url');
    console.log('FROM denda_keterlambatan_action');
    console.log('WHERE lampiran_1_url IS NOT NULL');
    console.log('LIMIT 5;');
    console.log('-------------------------------------------\n');
}

// ============================================================================
// MULTIPLE TEST CASES
// ============================================================================

async function runAllTests() {
    console.log('\n🚀 Starting Proxy File Tests...\n');
    
    // Test 1: Invalid URL format
    console.log('TEST 1: Invalid URL Format');
    try {
        await testProxyFile('https://not-a-drive-url.com/file');
    } catch (error) {
        console.log('Expected error:', error.message);
    }
    
    // Test 2: Missing url parameter
    console.log('\n\nTEST 2: Missing URL Parameter');
    const proxyUrl = `${API_BASE_URL}/api/denda/actions/proxy-file`;
    console.log('Testing:', proxyUrl);
    const protocol = proxyUrl.startsWith('https') ? https : http;
    
    await new Promise((resolve) => {
        protocol.get(proxyUrl, (res) => {
            console.log('Status:', res.statusCode, res.statusMessage);
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log('Response:', data);
                resolve();
            });
        }).on('error', (err) => {
            console.error('Error:', err.message);
            resolve();
        });
    });
    
    // Test 3: Valid URL (if provided)
    if (SAMPLE_DRIVE_URL !== 'https://drive.google.com/file/d/YOUR_FILE_ID_HERE/view') {
        console.log('\n\nTEST 3: Valid Drive URL');
        try {
            const result = await testProxyFile(SAMPLE_DRIVE_URL);
            if (result.success) {
                console.log('\n🎉 All tests passed!');
            }
        } catch (error) {
            console.error('Test failed:', error.message);
        }
    } else {
        console.log('\n\n⚠️  TEST 3 SKIPPED: Please update SAMPLE_DRIVE_URL in this script');
        await getSampleUrlFromDb();
    }
    
    console.log('\n===========================================');
    console.log('🏁 Tests completed');
    console.log('===========================================\n');
}

// ============================================================================
// RUN TESTS
// ============================================================================

if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = { testProxyFile, getSampleUrlFromDb };
