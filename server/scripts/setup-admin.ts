import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createOwner } from '@server/features/accounts/server/owner';
import { ensureCatalog } from '@database/seeds/initialize';
import { getDb } from '@database/index';

function readPassword(): Promise<string> {
    stdout.write('Mật khẩu chủ shop (từ 10 ký tự): ');
    return new Promise((resolve,reject)=>{
        let value='';
        stdin.setRawMode(true);stdin.resume();stdin.setEncoding('utf8');
        const done=(error?:Error)=>{
            stdin.off('data',handler);stdin.setRawMode(false);stdin.pause();stdout.write('\n');
            if(error)reject(error);else resolve(value);
        };
        const handler=(chunk:string)=>{
            for(const character of chunk){
                if(character==='\r'||character==='\n'){done();return;}
                if(character==='\u0003'){done(new Error('Đã hủy tạo tài khoản.'));return;}
                if(character==='\u007f'||character==='\b'){
                    if(value.length){value=value.slice(0,-1);stdout.write('\b \b');}
                }else if(character>=' '&&value.length<128){value+=character;stdout.write('*');}
            }
        };
        stdin.on('data',handler);
    });
}
const prompt=createInterface({input:stdin,output:stdout});
try {
    const name=process.env.ADMIN_NAME||await prompt.question('Tên chủ shop: ');
    const email=process.env.ADMIN_EMAIL||await prompt.question('Email chủ shop: ');
    let password=process.env.ADMIN_PASSWORD;
    if(!password&&stdin.isTTY){prompt.close();password=await readPassword();}
    else if(!password)password=await prompt.question('Mật khẩu chủ shop (từ 10 ký tự): ');
    const owner=await createOwner({name,email,password});
    await ensureCatalog();
    console.log('Đã tạo chủ shop:',owner.email);
} catch(error){console.error((error as Error).message);process.exitCode=1;}
finally{prompt.close();getDb().close();}
