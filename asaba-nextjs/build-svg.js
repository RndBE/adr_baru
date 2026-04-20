const fs = require('fs');

const offlineStr = fs.readFileSync('public/sokkia.svg', 'utf8');
const onlineStr = fs.readFileSync('public/sokkia_online.svg', 'utf8');

function extractPaths(svgStr) {
  let jsx = svgStr
    .replace(/stroke-linejoin/g, 'strokeLinejoin')
    .replace(/stroke-width/g, 'strokeWidth')
    .replace(/color-interpolation-filters/g, 'colorInterpolationFilters')
    .replace(/fill-opacity/g, 'fillOpacity')
    .replace(/class=/g, 'className=')
    .replace(/xmlns:xlink/g, 'xmlnsXlink');
  const inner = jsx.match(/<svg[^>]*>([\s\S]*)<\/svg>/)[1];
  return inner;
}

const offline = extractPaths(offlineStr);
const online = extractPaths(onlineStr);

const onlineAntennaRegex = /<path d="M11\.9841 5\.13636L11\.5353 46\.7327[\s\S]*?fill="#B5BEC6" stroke="black"\/>/;
const onlineCamRegex = /(<path d="M47\.5 32\.5432V31\.5[\s\S]*?fill="#F0F4F4" stroke="#020312"\/>)/;
const onlineScreenRegex = /(<g filter="url\(#filter16_di_378_33769\)">[\s\S]*?<path d="M42\.7245 94\.84C[\s\S]*?fill="#777777"\/>)/;
const offlineCamRegex = /(<path d="M53\.5 49\.5H49\.5C[\s\S]*?<path d="M39\.922 39\.9205L[\s\S]*?fill="#BCBDBF"\/>)/;

const offlineScreenHTML = `<g filter="url(#filter16_i_381_34016)">
<path d="M50.4929 86.397H23.7357C22.6711 86.397 21.793 87.231 21.7384 88.2942L20.9441 103.738C20.8853 104.881 21.7965 105.84 22.9414 105.84H50.4929C51.5975 105.84 52.4929 104.945 52.4929 103.84V88.397C52.4929 87.2924 51.5975 86.397 50.4929 86.397Z" fill="#6C6967"/>
</g>
<path d="M50.4929 86.397H23.7357C22.6711 86.397 21.793 87.231 21.7384 88.2942L20.9441 103.738C20.8853 104.881 21.7965 105.84 22.9414 105.84H50.4929C51.5975 105.84 52.4929 104.945 52.4929 103.84V88.397C52.4929 87.2924 51.5975 86.397 50.4929 86.397Z" stroke="black" strokeWidth="0.5"/>`;

const offlineCamMatch = offline.match(offlineCamRegex);
const offlineCamHTML = offlineCamMatch ? offlineCamMatch[1] : '';

let result = online;

const onlineAntennaMatch = result.match(onlineAntennaRegex);
if(onlineAntennaMatch) {
  result = result.replace(
    onlineAntennaRegex, 
    "<g style={{ transform: isOnline ? 'translateY(0)' : 'translateY(44px)', transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }}>\n" +
    onlineAntennaMatch[0] + "\n</g>"
  );
}

const onlineCamMatch = result.match(onlineCamRegex);
if(onlineCamMatch) {
  result = result.replace(
    onlineCamRegex,
    "<g style={{ transformOrigin: '50.5px 54px', transform: isOnline ? 'rotateX(180deg)' : 'rotateX(0deg)', opacity: isOnline ? 0 : 1, transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s step-end' }}>\n" +
    offlineCamHTML + "\n</g>\n" +
    "<g style={{ transformOrigin: '50.5px 54px', transform: isOnline ? 'rotateX(0deg)' : 'rotateX(-180deg)', opacity: isOnline ? 1 : 0, transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s step-start' }}>\n" +
    onlineCamMatch[1] + "\n</g>"
  );
}

const onlineScreenMatch = result.match(onlineScreenRegex);
if(onlineScreenMatch) {
  result = result.replace(
    onlineScreenRegex,
    "<g style={{ opacity: isOnline ? 0 : 1, transition: 'opacity 0.5s 0.2s' }}>\n" +
    offlineScreenHTML + "\n</g>\n<g style={{ opacity: isOnline ? 1 : 0, transition: 'opacity 0.5s 0.2s' }}>\n" +
    onlineScreenMatch[1] + "\n</g>"
  );
}

const missingFilter = `<filter id="filter16_i_381_34016" x="20.6914" y="86.147" width="33.0508" height="20.9434" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
<feFlood floodOpacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dx="2" dy="2"/>
<feGaussianBlur stdDeviation="0.5"/>
<feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"/>
<feBlend mode="normal" in2="shape" result="effect1_innerShadow_381_34016"/>
</filter>`;
result = result.replace(/<\/defs>/, missingFilter + '\n</defs>');

const componentString = `import React from "react";

export default function AnimatedRTS({ isOnline, className }: { isOnline: boolean, className?: string }) {
  return (
    <svg width="120" height="134" viewBox="0 0 120 134" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      ${result}
    </svg>
  );
}
`;

fs.writeFileSync('src/components/AnimatedRTS.tsx', componentString);
console.log("Animation Component Built Successfully!");
