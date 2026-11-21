import assert from 'node:assert/strict'
import test from 'node:test'
import { openedWorkspaceServices, rememberWorkspaceService, workspaceHomeServices, workspaceServiceHref, type WorkspaceService } from '../src/lib/workspaceHome'
import { workspaceSignInHref } from '../src/lib/workspaceNavigation'

const service = (syncId:string,changedAt:string,status:WorkspaceService['status']='planning'):WorkspaceService => ({syncId,title:syncId,serviceDate:'2026-10-04',changedAt,status})
test('continue the accessible service last opened by this person, excluding it from the other recents', () => {
  const result = workspaceHomeServices([service('older','2026-10-01'),service('newer','2026-10-02'),service('third','2026-09-30')],['older','older'])
  assert.equal(result.continued?.syncId,'older'); assert.equal(result.personal,true)
  assert.deepEqual(result.recent.map(service=>service.syncId),['newer','third'])
})
test('stale, inaccessible and archived local history falls back to the newest active service', () => {
  const result = workspaceHomeServices([service('archived','2026-10-03','archived'),service('cancelled','2026-10-04','cancelled'),service('active','2026-10-01','ready')],['inaccessible','archived','cancelled'])
  assert.equal(result.continued?.syncId,'active'); assert.equal(result.personal,false)
  assert.deepEqual(workspaceHomeServices([],['gone']),{continued:null,personal:false,recent:[]})
})
test('recent service preferences are isolated by account and church, bounded, and tolerate corrupt or disabled storage', () => {
  const values = new Map<string,string>(), storage = {getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value)}}
  const person = {workspaceUserId:1,workspaceCommunityId:7}
  for(let i=0;i<12;i++) rememberWorkspaceService(storage,person,`service-${i}`)
  assert.equal(openedWorkspaceServices(storage,person).length,8)
  rememberWorkspaceService(storage,person,'service-5')
  assert.equal(openedWorkspaceServices(storage,person)[0],'service-5')
  assert.deepEqual(openedWorkspaceServices(storage,{...person,workspaceUserId:2}),[])
  assert.deepEqual(openedWorkspaceServices(storage,{...person,workspaceCommunityId:8}),[])
  const broken = {getItem:()=>'{broken',setItem:()=>{throw new Error('Disabled')}}
  assert.deepEqual(openedWorkspaceServices(broken,person),[])
  assert.doesNotThrow(()=>rememberWorkspaceService(broken,person,'service-1'))
})
test('service entry and sign-in preserve the selected service or new-service form, never a foreign redirect', () => {
  assert.equal(workspaceServiceHref('service:2026-10-04'),'/admin/plan-service?service=service%3A2026-10-04')
  assert.equal(new URL(workspaceSignInHref('/admin/plan-service',{service:'service-1',redirect:'https://foreign.test'}),'https://church.test').searchParams.get('redirect'),'/admin/plan-service?service=service-1')
  assert.equal(new URL(workspaceSignInHref('/admin/plan-service',{new:'1'}),'https://church.test').searchParams.get('redirect'),'/admin/plan-service?new=1')
})
