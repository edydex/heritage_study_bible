import React,{useState,useEffect} from 'react'
import {createRoot} from 'react-dom/client'
import CommunityBookReadAlong from '../../../src/components/CommunityBookReadAlong'
function App(){const [book,setBook]=useState();useEffect(()=>{fetch('/fixture.json').then(r=>r.json()).then(setBook)},[]);return book?<CommunityBookReadAlong document={book} contentUrl={location.origin+'/content/books/42'} requestOptions={{authorization:'Community dummy-book-test',authorizationOrigin:location.origin}}/>:null}
createRoot(document.getElementById('root')).render(<App/> )
