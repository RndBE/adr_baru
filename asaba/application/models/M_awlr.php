<?php
class M_awlr extends CI_Model {

	function __construct(){
		parent::__construct();
		
	}

 function update_lengkungdebit($idlogger,$data)
 {
	 $this->db->where('idlogger', $idlogger);
	$this->db->update('datasheet_debit', $data);
	 
 }
	 function update_siaga($idlogger,$data)
 {
	 $this->db->where('idlogger', $idlogger);
	$this->db->update('klasifikasi_tma', $data);
	 
 }
}