import fetch from 'node-fetch'
import cron from 'node-cron'
import 'dotenv/config'

const zoneId = process.env.ZONE_ID
const domains = (process.env.DOMAINS || '').split(',')
const apiToken = process.env.API_TOKEN
const useIPV6 = (process.env.IPV6 || 'false') == 'true'
const useIPV4 = (process.env.IPV4 || 'false') == 'true'
const ttl = process.env.TTL || 1
const cronTab = process.env.CRON || '5 * * * *'

console.log({
  useIPV4,
  useIPV6,
  zoneId,
  domains,
  ttl,
  cronTab
})

if (!zoneId || domains.length === 0, !apiToken) {
  console.log('Missing enviromnent variables!')
  process.exit(1)
}

var currentV6 = ''
var currentV4 = ''
////
async function getV6() {
  const response = await fetch(`https://api6.ipify.org?format=json`);
  const result = await response.json();
  return result.ip
}

async function getV4() {
  const response = await fetch(`https://api4.ipify.org?format=json`);
  const result = await response.json();
  return result.ip
}

////
async function updateRecordV6(zoneId, dnsIdentifier, ipv6, name) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${dnsIdentifier}`, {
    method: 'put',
    body: JSON.stringify({
      type: 'AAAA',
      content: ipv6,
      name,
      ttl
    }),
    headers: {
      Authorization: `Bearer ${apiToken}`
    }
  });
  if(response.status != 200) return Promise.reject('Cannot update! ' + name + ' responded with ' + response.status)
}
async function updateRecordV4(zoneId, dnsIdentifier, ipv4, name) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${dnsIdentifier}`, {
    method: 'put',
    body: JSON.stringify({
      type: 'A',
      content: ipv4,
      name,
      ttl
    }),
    headers: {
      Authorization: `Bearer ${apiToken}`
    }
  });
  if(response.status != 200) return Promise.reject('Cannot update! ' + name + ' responded with ' + response.status)
}

////
async function updateZoneV6(zoneId, domains, ipv6) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?match=all`, {
    headers: {
      Authorization: `Bearer ${apiToken}`
    }
  });
  const { success, result } = await response.json();
  if(response.status != 200) return Promise.reject('Failed to get Zone! ' + zoneId + ' responded with ' + response.status)
  
  const toBeUpdated = result.filter(r => r.type === 'AAAA' && domains.includes(r.name) )
  if (toBeUpdated.length === 0) {
    return Promise.reject('No Domain found!')
  }

  if (domains.length != toBeUpdated.length) console.warn('Not all Domains applied! Are all created in cloudflare?')

  for (let i = 0; i < toBeUpdated.length; i++) {
    console.log('update ' + toBeUpdated[i].name)
    await updateRecordV6(zoneId, toBeUpdated[i].id, ipv6, toBeUpdated[i].name)
    
  }
  console.log(`${toBeUpdated.map(r=>r.name).join()} updated to '${ipv6}'`)
}

async function updateZoneV4(zoneId, domains, ipv4) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?match=all`, {
    headers: { Authorization: `Bearer ${apiToken}` }
  });
  const { success, result } = await response.json();
  if(response.status != 200) return Promise.reject('Failed to get Zone! ' + zoneId + ' responded with ' + response.status)
  
  const toBeUpdated = result.filter(r => r.type === 'A' && domains.includes(r.name) )
  if (toBeUpdated.length === 0) {
    return Promise.reject('No Domain found!')
  }

  if (domains.length != toBeUpdated.length) console.warn('Not all Domains applied! Are all created in cloudflare?')

  for (let i = 0; i < toBeUpdated.length; i++) {
    console.log('update ' + toBeUpdated[i].name)
    await updateRecordV4(zoneId, toBeUpdated[i].id, ipv4, toBeUpdated[i].name)
    
  }
  console.log(`${toBeUpdated.map(r=>r.name).join()} updated to '${ipv4}'`)
}

////
async function updateV6() {
  const ipv6 = await getV6()
  if (currentV6 == ipv6) {
    console.log(new Date())
    console.log('Skip. No ipv6 changed!', currentV6, ipv6)
    return
  }
  await updateZoneV6(zoneId, domains, ipv6)
  currentV6 == ipv6
  console.log('finished ipv6')
}

async function updateV4() {
  const ipv4 = await getV4()
  if (currentV4 == ipv4) {
    console.log(new Date())
    console.log('Skip. No ipv4 changed!', currentV4, ipv4)
    return
  }
  await updateZoneV4(zoneId, domains, ipv4)
  currentV4 == ipv4
  console.log('finished ipv4')
}

if (useIPV6) await updateV6()
if (useIPV4) await updateV4()

cron.schedule(cronTab, async () => {
  console.log('start')
  if (useIPV6) await updateV6()
  if (useIPV4) await updateV4()
  console.log('finished at ' + new Date())
});

